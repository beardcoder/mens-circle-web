/* eslint-disable no-console */
/** Run by admin-session-secret.test.ts: no session is signed or trusted without a proper secret. */
import assert from 'node:assert/strict';

const encoder = new TextEncoder();
const base64url = (bytes: Uint8Array): string => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** A session token signed with an arbitrary key. */
async function forgeToken(email: string, key: string, exp = Date.now() + 60_000): Promise<string> {
  const payload = base64url(encoder.encode(JSON.stringify({ email, exp })));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = base64url(new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payload))));
  return `${payload}.${sig}`;
}

const { config } = await import('../src/lib/server/config');
const auth = await import('../src/lib/server/auth');

switch (process.argv[2]) {
  // Nothing set at all — the totally unconfigured deployment.
  case 'unset': {
    assert.equal(config.ADMIN_SESSION_SECRET, '');
    assert.equal(auth.sessionSecretConfigured(), false);
    await assert.rejects(auth.createSession('a@b.c'), 'nothing may be signed without a secret');

    // The old literal default must not verify.
    const forgedWithOldDefault = await forgeToken('attacker@evil.example', 'change-me');
    assert.equal(await auth.readSession(forgedWithOldDefault), null);
    assert.equal(await auth.readSession('anything.at.all'), null);
    break;
  }

  // A stale ADMIN_PASSWORD left in the environment, no session secret — the
  // case that used to silently fall back to signing with the password.
  case 'password-only': {
    assert.equal(config.ADMIN_SESSION_SECRET, '');
    assert.equal(auth.sessionSecretConfigured(), false);

    // A token forged with the password as the key (the old fallback) must no
    // longer verify — the fallback itself is gone, not just gated later.
    const forgedWithPassword = await forgeToken('admin@example.invalid', 'correct-horse-battery-staple');
    assert.equal(await auth.readSession(forgedWithPassword), null);
    break;
  }

  // A secret that is set but too short to be one — treated as unset, even for
  // a token that really was signed with it.
  case 'short': {
    assert.equal(auth.sessionSecretConfigured(), false);
    assert.equal(await auth.readSession(await forgeToken('admin@example.invalid', 'short-secret')), null);
    break;
  }

  // Everything configured, with its own distinct secret — the healthy path
  // must work exactly as before.
  case 'configured': {
    assert.equal(config.ADMIN_SESSION_SECRET, 'a-long-random-session-secret-for-the-test-suite');
    assert.equal(auth.sessionSecretConfigured(), true);

    const token = await auth.createSession('admin@example.invalid');
    assert.equal(await auth.readSession(token), 'admin@example.invalid');

    // A token signed with a guessed secret still fails on its own merits —
    // the fix must not have weakened the existing signature check.
    const forgedWithWrongSecret = await forgeToken('admin@example.invalid', 'a-guessed-secret');
    assert.equal(await auth.readSession(forgedWithWrongSecret), null);
    break;
  }

  default:
    throw new Error('Unknown admin-session-secret scenario');
}

console.log(`PASS ${process.argv[2]}`);
