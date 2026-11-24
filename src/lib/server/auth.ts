/** HMAC-signed tokens (`<base64url JSON>.<base64url HMAC>`), as the cancel links use them. */
import { config } from './config';

const encoder = new TextEncoder();

const base64url = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64url');
const fromBase64url = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(Buffer.from(s, 'base64url'));

/** Signing needs a secret of ≥ 32 characters; without one nothing is signed or trusted. */
const signingSecretConfigured = (): boolean => config.CANCEL_LINK_SECRET.length >= 32;

const getHmacKey = (() => {
  let cached: Promise<CryptoKey> | null = null;

  return () =>
    (cached ??= crypto.subtle.importKey(
      'raw',
      encoder.encode(config.CANCEL_LINK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    ));
})();

/** A token carrying `data`, expiring `ttlS` seconds from now. */
export const signToken = async (data: Record<string, unknown>, ttlS: number): Promise<string> => {
  if (!signingSecretConfigured()) throw new Error('CANCEL_LINK_SECRET is missing or shorter than 32 characters');

  const payload = base64url(encoder.encode(JSON.stringify({ ...data, exp: Date.now() + ttlS * 1000 })));
  const sig = await crypto.subtle.sign('HMAC', await getHmacKey(), encoder.encode(payload));

  return `${payload}.${base64url(new Uint8Array(sig))}`;
};

/** The token's data if the signature holds and it has not expired, else null.
 *  `subtle.verify` compares in constant time, so no hand-rolled comparison. */
export const verifyToken = async <T extends Record<string, unknown>>(token: string | undefined): Promise<T | null> => {
  if (!signingSecretConfigured()) return null;

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
