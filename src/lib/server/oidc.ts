/**
 * Admin sign-in through Pocket ID — OpenID Connect via `openid-client`:
 * authorization code flow with PKCE and `state`. The library does discovery,
 * the code exchange and the ID token checks; what stays here is who counts as
 * an admin, and carrying `state` + verifier across the provider round-trip in a
 * short-lived signed cookie.
 */
import * as client from 'openid-client';
import { sessionSecretConfigured, signToken, verifyToken } from './auth';
import { config } from './config';

export const FLOW_COOKIE = 'mc_oidc';
export const FLOW_TTL_S = 10 * 60;

type Flow = { state: string; verifier: string; redirect: string };

/** Signed in fine at the provider, but not someone who may enter /admin. */
export class AccessDenied extends Error {}

export const oidcConfigured = (): boolean =>
  Boolean(config.OIDC_ISSUER && config.OIDC_CLIENT_ID && config.OIDC_CLIENT_SECRET) &&
  sessionSecretConfigured() &&
  (config.ADMIN_EMAILS.length > 0 || config.ADMIN_GROUP.length > 0);

export const callbackUrl = (): string => `${config.APP_URL}/auth/callback`;

/** Only same-site admin paths; anything else falls back to the dashboard. */
export const safeRedirect = (target: string | null | undefined): string =>
  target && /^\/admin(?:[/?#]|$)/.test(target) ? target : '/admin';

let discovered: Promise<client.Configuration> | null = null;
const provider = (): Promise<client.Configuration> =>
  (discovered ??= client
    .discovery(
      new URL(config.OIDC_ISSUER),
      config.OIDC_CLIENT_ID,
      undefined,
      // Post, not Basic: Basic form-encodes the id first (RFC 6749 §2.3.1), so a
      // UUID client id arrives as `4d29cf9d%2De1ac…` — whether the provider
      // decodes that is its choice. The body carries it verbatim.
      client.ClientSecretPost(config.OIDC_CLIENT_SECRET),
      { timeout: 10 },
    )
    .catch((err: unknown) => {
      discovered = null; // retry on the next sign-in instead of caching the failure
      throw err;
    }));

/** The provider URL to send the browser to, plus the flow cookie to set first. */
export const beginLogin = async (redirect: string): Promise<{ url: string; cookie: string }> => {
  const flow: Flow = {
    state: client.randomState(),
    verifier: client.randomPKCECodeVerifier(),
    redirect: safeRedirect(redirect),
  };
  const url = client.buildAuthorizationUrl(await provider(), {
    redirect_uri: callbackUrl(),
    scope: config.ADMIN_GROUP ? 'openid email groups' : 'openid email',
    state: flow.state,
    code_challenge: await client.calculatePKCECodeChallenge(flow.verifier),
    code_challenge_method: 'S256',
  });
  return { url: url.href, cookie: await signToken(flow, FLOW_TTL_S) };
};

/** Group membership is managed by the Pocket ID admin, so it wins when set;
 *  an email only counts once the provider has verified it. */
const isAdmin = (user: client.UserInfoResponse, email: string): boolean => {
  const groups = Array.isArray(user.groups) ? user.groups : [];
  if (config.ADMIN_GROUP && groups.includes(config.ADMIN_GROUP)) return true;
  return user.email_verified !== false && config.ADMIN_EMAILS.includes(email);
};

/**
 * Completes the flow from the callback's query string. Returns the admin's
 * email and where to send them; throws `AccessDenied` for a valid sign-in by a
 * non-admin and any other error for a broken or forged round-trip.
 */
export const completeLogin = async (
  search: string,
  flowCookie: string | undefined,
): Promise<{ email: string; redirect: string }> => {
  const flow = await verifyToken<Flow>(flowCookie);
  if (!flow) throw new Error('sign-in flow cookie missing, expired or forged');

  // Rebuilt from APP_URL rather than the request: behind the TLS-terminating
  // proxy the request reads http://, and this URL is the redirect_uri that the
  // token request must repeat exactly.
  const currentUrl = new URL(callbackUrl());
  currentUrl.search = search;

  const config_ = await provider();
  const tokens = await client.authorizationCodeGrant(config_, currentUrl, {
    pkceCodeVerifier: flow.verifier,
    expectedState: flow.state,
  });
  const subject = tokens.claims()?.sub;
  if (!subject) throw new Error('no ID token subject');
  const user = await client.fetchUserInfo(config_, tokens.access_token, subject);

  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (!email || !isAdmin(user, email)) throw new AccessDenied(email || 'no email');
  return { email, redirect: flow.redirect };
};
