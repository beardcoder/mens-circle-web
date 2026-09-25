import { config } from './config';

export const SESSION_COOKIE = 'mc_admin';
export const SESSION_TTL_S = 7 * 24 * 60 * 60;

const encoder = new TextEncoder();

const base64url = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64url');
const fromBase64url = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(Buffer.from(s, 'base64url'));

/**
 * Whether the site can sign or verify a session at all. Checked where it
 * matters — signing and verifying — rather than once at startup: config.ts is
 * imported by every server-side caller (the reminder job included), and those
 * have nothing to do with admin auth, so failing there would take down
 * unrelated functionality over a var only /admin needs. 32 characters is the
 * floor: an HMAC key shorter than that is a password, not a secret.
 */
export const sessionSecretConfigured = (): boolean => config.ADMIN_SESSION_SECRET.length >= 32;

const getHmacKey = (() => {
  let cached: Promise<CryptoKey> | null = null;
  return () =>
    (cached ??= crypto.subtle.importKey(
      'raw',
      encoder.encode(config.ADMIN_SESSION_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    ));
})();

/** `<base64url JSON>.<base64url HMAC>`, expiring `ttlS` seconds from now. */
export const signToken = async (data: Record<string, unknown>, ttlS: number): Promise<string> => {
  if (!sessionSecretConfigured()) throw new Error('ADMIN_SESSION_SECRET is missing or shorter than 32 characters');
  const payload = base64url(encoder.encode(JSON.stringify({ ...data, exp: Date.now() + ttlS * 1000 })));
  const sig = await crypto.subtle.sign('HMAC', await getHmacKey(), encoder.encode(payload));
  return `${payload}.${base64url(new Uint8Array(sig))}`;
};

/** The token's data if the signature holds and it has not expired, else null.
 *  `subtle.verify` compares in constant time, so no hand-rolled comparison. */
export const verifyToken = async <T extends Record<string, unknown>>(token: string | undefined): Promise<T | null> => {
  // A token signed before the secret was unset (or forged against a guessed
  // one) must never be trusted just because it verifies against whatever key
  // an empty string would produce.
  if (!sessionSecretConfigured()) return null;
  const [payload, sig] = token?.split('.') ?? [];
  if (!payload || !sig) return null;
  try {
    const valid = await crypto.subtle.verify('HMAC', await getHmacKey(), fromBase64url(sig), encoder.encode(payload));
    if (!valid) return null;
    const data = JSON.parse(new TextDecoder().decode(fromBase64url(payload))) as T & { exp?: number };
    return typeof data.exp === 'number' && data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
};

export const createSession = (email: string): Promise<string> => signToken({ email }, SESSION_TTL_S);

export const readSession = async (token: string | undefined): Promise<string | null> => {
  const data = await verifyToken<{ email?: unknown }>(token);
  return typeof data?.email === 'string' ? data.email : null;
};
