/* eslint-disable no-console */
// Executed only by admin-oidc.test.ts in a separate Bun process.
import assert from 'node:assert/strict';

assert(process.env.OIDC_TEST, 'requires the isolated test harness');

const ISSUER = 'https://id.example.invalid';
type UserInfo = Record<string, unknown>;
let userinfo: UserInfo = { email: 'admin@example.invalid', email_verified: true };
let providerUp = true;
let lastChallenge = '';
let tokenCalls = 0;

const b64url = (data: ArrayBuffer | Uint8Array | string) =>
  Buffer.from(typeof data === 'string' ? data : new Uint8Array(data)).toString('base64url');
const sha256 = async (value: string) => b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));

// A real RS256 key, so the ID token passes the library's checks like Pocket ID's would.
const keys = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify'],
);
const jwk = { ...(await crypto.subtle.exportKey('jwk', keys.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
const idToken = async (claims: Record<string, unknown>) => {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'k1' }));
  const body = b64url(
    JSON.stringify({ iss: ISSUER, aud: 'client-id', sub: 'user-1', iat: now, exp: now + 300, ...claims }),
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keys.privateKey,
    new TextEncoder().encode(`${header}.${body}`),
  );
  return `${header}.${body}.${b64url(sig)}`;
};

const routes: Record<string, (init?: RequestInit) => Response | Promise<Response>> = {
  '/.well-known/openid-configuration': () =>
    Response.json({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/api/oidc/token`,
      userinfo_endpoint: `${ISSUER}/api/oidc/userinfo`,
      jwks_uri: `${ISSUER}/.well-known/jwks.json`,
      id_token_signing_alg_values_supported: ['RS256'],
    }),
  '/.well-known/jwks.json': () => Response.json({ keys: [jwk] }),
  '/api/oidc/token': async (init) => {
    tokenCalls++;
    const body = new URLSearchParams(String(init?.body));
    assert.equal(body.get('client_id'), 'client-id');
    assert.equal(body.get('client_secret'), 'client-secret');
    assert.equal(body.get('grant_type'), 'authorization_code');
    assert.equal(body.get('code'), 'the-code');
    assert.equal(body.get('redirect_uri'), 'https://app.example.invalid/auth/callback');
    assert.equal(await sha256(body.get('code_verifier') ?? ''), lastChallenge, 'PKCE verifier must match');
    return Response.json({ access_token: 'the-access-token', token_type: 'Bearer', id_token: await idToken({}) });
  },
  '/api/oidc/userinfo': (init) => {
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer the-access-token');
    return Response.json({ sub: 'user-1', ...userinfo });
  },
};

// Never retain a reference to real fetch.
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  assert.equal(url.origin, ISSUER);
  assert(init?.signal instanceof AbortSignal, 'every provider call needs a timeout');
  if (!providerUp) return new Response('down', { status: 503 });
  const route = routes[url.pathname];
  if (!route) throw new Error(`unexpected request ${url.pathname}`);
  return route(init);
}) as typeof fetch;

const oidc = await import('../src/lib/server/oidc');
const { readSession, createSession } = await import('../src/lib/server/auth');

/** Runs beginLogin and returns what the provider would send back. */
const start = async (redirect = '/admin/events/new') => {
  const { url, cookie } = await oidc.beginLogin(redirect);
  const auth = new URL(url);
  assert.equal(auth.origin + auth.pathname, `${ISSUER}/authorize`);
  assert.equal(auth.searchParams.get('client_id'), 'client-id');
  assert.equal(auth.searchParams.get('redirect_uri'), 'https://app.example.invalid/auth/callback');
  assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
  lastChallenge = auth.searchParams.get('code_challenge') ?? '';
  const state = auth.searchParams.get('state') ?? '';
  return {
    cookie,
    state,
    scope: auth.searchParams.get('scope'),
    search: `?${new URLSearchParams({ code: 'the-code', state })}`,
  };
};

const rejects = async (promise: Promise<unknown>, type: new (...args: never[]) => Error) => {
  await assert.rejects(promise, (err) => err instanceof type);
};
/** A broken round-trip: refused before the token endpoint is ever called, and
 *  not by one of this fake's own assertions. */
const refusesFlow = async (promise: Promise<unknown>) => {
  const before = tokenCalls;
  await assert.rejects(
    promise,
    (err) => !(err instanceof oidc.AccessDenied) && !(err instanceof assert.AssertionError),
  );
  assert.equal(tokenCalls, before, 'no code exchange for a forged or stale flow');
};

const scenarios: Record<string, () => Promise<void>> = {
  'happy-path': async () => {
    assert(oidc.oidcConfigured());
    const { cookie, search, scope } = await start();
    assert.equal(scope, 'openid email');
    const result = await oidc.completeLogin(search, cookie);
    assert.deepEqual(result, { email: 'admin@example.invalid', redirect: '/admin/events/new' });
    assert.equal(await readSession(await createSession(result.email)), 'admin@example.invalid');
  },
  'group-admission': async () => {
    userinfo = { email: 'someone@example.invalid', email_verified: true, groups: ['mens-circle-admins'] };
    const { cookie, search, scope } = await start();
    assert.equal(scope, 'openid email groups');
    assert.equal((await oidc.completeLogin(search, cookie)).email, 'someone@example.invalid');

    userinfo = { email: 'someone@example.invalid', email_verified: true, groups: ['other'] };
    const second = await start();
    await rejects(oidc.completeLogin(second.search, second.cookie), oidc.AccessDenied);
  },
  'unlisted-email': async () => {
    userinfo = { email: 'stranger@example.invalid', email_verified: true };
    const { cookie, search } = await start();
    await rejects(oidc.completeLogin(search, cookie), oidc.AccessDenied);
  },
  'unverified-email': async () => {
    userinfo = { email: 'admin@example.invalid', email_verified: false };
    const { cookie, search } = await start();
    await rejects(oidc.completeLogin(search, cookie), oidc.AccessDenied);
  },
  'state-mismatch': async () => {
    const { cookie } = await start();
    await refusesFlow(oidc.completeLogin('?code=the-code&state=forged', cookie));
    // A flow cookie from another browser's attempt does not fit this state either.
    const other = await start();
    const mine = await start();
    await refusesFlow(oidc.completeLogin(mine.search, other.cookie));
    await refusesFlow(oidc.completeLogin(mine.search, undefined));
  },
  'tampered-flow-cookie': async () => {
    const { cookie, search } = await start();
    const [payload, sig] = cookie.split('.');
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const forged = Buffer.from(JSON.stringify({ ...data, redirect: 'https://evil.example' })).toString('base64url');
    await refusesFlow(oidc.completeLogin(search, `${forged}.${sig}`));
    assert.equal(await readSession(`${forged}.${sig}`), null);
  },
  'provider-down': async () => {
    providerUp = false;
    await rejects(oidc.beginLogin('/admin'), Error);
    // A failed discovery is not cached: the next attempt reaches the provider again.
    providerUp = true;
    assert.match((await oidc.beginLogin('/admin')).url, /^https:\/\/id\.example\.invalid\/authorize\?/);
  },
  'safe-redirect': async () => {
    assert.equal(oidc.safeRedirect('/admin/testimonials'), '/admin/testimonials');
    assert.equal(oidc.safeRedirect('/admin'), '/admin');
    assert.equal(oidc.safeRedirect('/admin?x=1'), '/admin?x=1');
    for (const bad of ['//evil.example', 'https://evil.example', '/administrator', '/', '', null]) {
      assert.equal(oidc.safeRedirect(bad), '/admin', String(bad));
    }
    const { cookie, search } = await start('https://evil.example/admin');
    assert.equal((await oidc.completeLogin(search, cookie)).redirect, '/admin');
  },
  unconfigured: async () => {
    assert.equal(oidc.oidcConfigured(), false, 'a short session secret must disable sign-in');
  },
};

const scenario = process.argv[2];
assert(scenario in scenarios, `unknown scenario: ${scenario}`);
await scenarios[scenario]();
console.log(`PASS ${scenario}`);
