import { config } from './config';

export const SESSION_COOKIE = 'mc_admin';
export const SESSION_TTL_S = 7 * 24 * 60 * 60;
const SESSION_TTL_MS = SESSION_TTL_S * 1000;

const encoder = new TextEncoder();

const base64url = (bytes: Uint8Array): string => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const base64urlToBytes = (s: string): Uint8Array => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return Uint8Array.from({ length: bin.length }, (_, i) => bin.charCodeAt(i));
};

const getHmacKey = (() => {
  let cached: Promise<CryptoKey> | null = null;
  return () =>
    (cached ??= crypto.subtle.importKey(
      'raw',
      encoder.encode(config.ADMIN_SESSION_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    ));
})();

const hmac = async (message: string): Promise<Uint8Array> => {
  const key = await getHmacKey();
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
};

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const verifyCredentials = (email: string, password: string): boolean => {
  const e = (email || '').trim().toLowerCase();
  if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD) return false;
  return (
    timingSafeEqual(e, config.ADMIN_EMAIL.trim().toLowerCase()) &&
    timingSafeEqual(password || '', config.ADMIN_PASSWORD)
  );
};

export const createSession = async (email: string): Promise<string> => {
  const payload = base64url(encoder.encode(JSON.stringify({ email, exp: Date.now() + SESSION_TTL_MS })));
  const sig = base64url(await hmac(payload));
  return `${payload}.${sig}`;
};

export const readSession = async (token: string | undefined): Promise<string | null> => {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = base64url(await hmac(payload));
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(base64urlToBytes(payload))) as { email: string; exp: number };
    if (!data.exp || data.exp < Date.now()) return null;
    return data.email;
  } catch {
    return null;
  }
};
