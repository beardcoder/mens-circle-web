/**
 * Admin authentication (server-only).
 *
 * A single operator authenticates against ADMIN_EMAIL / ADMIN_PASSWORD; the
 * session is a signed (HMAC-SHA256) cookie value — no DB table, mirroring the
 * old "superuser from env" model. Replaces PocketBase's admin auth.
 */
import { config } from './config';

export const SESSION_COOKIE = 'mc_admin';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(config.ADMIN_SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verify login credentials against the configured admin. */
export function verifyCredentials(email: string, password: string): boolean {
  const e = (email || '').trim().toLowerCase();
  if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD) return false;
  // Constant-ish comparison; credentials are low-cardinality so this is fine.
  return (
    timingSafeEqual(e, config.ADMIN_EMAIL.trim().toLowerCase()) &&
    timingSafeEqual(password || '', config.ADMIN_PASSWORD)
  );
}

/** Create a signed session token for the given email. */
export async function createSession(email: string): Promise<string> {
  const payload = base64url(encoder.encode(JSON.stringify({ email, exp: Date.now() + SESSION_TTL_MS })));
  const sig = base64url(await hmac(payload));
  return `${payload}.${sig}`;
}

/** Validate a session token; returns the email when valid, else null. */
export async function readSession(token: string | undefined): Promise<string | null> {
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
}
