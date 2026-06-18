/**
 * Minimal admin auth — a single env-configured admin, an HMAC-signed session
 * cookie, no database table and no third-party dependency. Replaces the
 * PocketBase `_superusers` login for the slim custom admin.
 */
import { config } from './config';

export const SESSION_COOKIE = 'mc_admin';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(s: string): string {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/'));
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(config.SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64url(sig);
}

/** Timing-safe string comparison. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function adminConfigured(): boolean {
  return config.ADMIN_EMAIL.length > 0 && config.ADMIN_PASSWORD.length > 0;
}

export function checkCredentials(email: string, password: string): boolean {
  if (!adminConfigured()) return false;
  return (
    safeEqual(
      email.trim().toLowerCase(),
      config.ADMIN_EMAIL.trim().toLowerCase(),
    ) && safeEqual(password, config.ADMIN_PASSWORD)
  );
}

/** Build a signed session token for the admin email. */
export async function createSession(email: string): Promise<string> {
  const payload = base64url(
    encoder.encode(
      JSON.stringify({ e: email, x: Date.now() + MAX_AGE_SECONDS * 1000 }),
    ),
  );
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

/** Verify a session token; returns the admin email or null. */
export async function verifySession(
  token: string | undefined,
): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = await hmac(payload);
  if (!safeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(fromBase64url(payload)) as { e: string; x: number };
    if (!data.x || data.x < Date.now()) return null;
    return data.e;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: config.APP_URL.startsWith('https://'),
  maxAge: MAX_AGE_SECONDS,
};
