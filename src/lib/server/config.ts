/**
 * Server-side configuration, read from environment variables with sane
 * defaults. Replaces the former PocketBase `pb_hooks/lib/config.js`.
 *
 * This module is server-only (Bun runtime) — never import it into client code.
 */

function env(key: string, fallback = ''): string {
  const v = process.env[key];
  return v && v.length > 0 ? v : fallback;
}

/** Parse a comma-separated list of integers ("1,3,4") into a number array. */
export function parseIntList(raw: string): number[] {
  if (!raw) return [];
  const out: number[] = [];
  for (const part of String(raw).split(',')) {
    const token = part.trim();
    if (token === '') continue;
    const n = Number.parseInt(token, 10);
    // listmonk's admin API expects numeric list IDs, not UUIDs. A UUID would
    // silently become NaN — skip it loudly instead of dropping people silently.
    if (Number.isNaN(n) || String(n) !== token) {
      // eslint-disable-next-line no-console
      console.warn(`[config] ignoring non-numeric listmonk list id "${token}" — expected the numeric ID, not a UUID`);
      continue;
    }
    out.push(n);
  }
  return out;
}

export const config = {
  APP_URL: env('APP_URL', env('PUBLIC_SITE_URL', 'https://mens-circle.de')).replace(/\/+$/, ''),
  SITE_NAME: env('SITE_NAME', 'Männerkreis Niederbayern/ Straubing'),
  MAIL_FROM_ADDRESS: env('MAIL_FROM_ADDRESS', 'hallo@mens-circle.de'),
  MAIL_FROM_NAME: env('MAIL_FROM_NAME', 'Männerkreis Niederbayern/ Straubing'),
  MAIL_ADMIN_ADDRESS: env('MAIL_ADMIN_ADDRESS', 'hallo@mens-circle.de'),
  MAIL_ADMIN_NAME: env('MAIL_ADMIN_NAME', 'Männerkreis Admin'),
  CONTACT_EMAIL: env('MAIL_CONTACT_ADDRESS', 'hallo@mens-circle.de'),

  // SQLite database file (bun:sqlite). A relative path resolves against the
  // process working directory; in the container this points at the mounted
  // data volume.
  DATABASE_PATH: env('DATABASE_PATH', './data/mens-circle.db'),

  // Admin UI — single operator authenticated against these credentials, with a
  // signed session cookie. ADMIN_SESSION_SECRET signs the cookie (set a long
  // random value in production; falls back to the password so a misconfigured
  // deploy still works but should be set explicitly).
  ADMIN_EMAIL: env('ADMIN_EMAIL', ''),
  ADMIN_PASSWORD: env('ADMIN_PASSWORD', ''),
  ADMIN_SESSION_SECRET: env('ADMIN_SESSION_SECRET', env('ADMIN_PASSWORD', 'change-me')),

  // listmonk — newsletter subscribers + per-event lists + transactional email.
  LISTMONK_URL: env('LISTMONK_URL', '').replace(/\/+$/, ''),
  LISTMONK_API_USER: env('LISTMONK_API_USER', ''),
  LISTMONK_API_TOKEN: env('LISTMONK_API_TOKEN', ''),
  LISTMONK_LIST_IDS: parseIntList(env('LISTMONK_LIST_IDS', '')),

  // Numeric IDs of the listmonk *transactional* templates (Admin → Campaigns →
  // Templates → "Transactional"). The app posts to listmonk's /api/tx with the
  // template ID + a data payload; the template owns the markup, the app the
  // data. 0/empty means the corresponding email is skipped (logged).
  TX_REGISTRATION_CONFIRMATION: Number.parseInt(env('LISTMONK_TX_REGISTRATION_CONFIRMATION', '0'), 10) || 0,
  TX_WAITLIST_CONFIRMATION: Number.parseInt(env('LISTMONK_TX_WAITLIST_CONFIRMATION', '0'), 10) || 0,
  TX_ADMIN_NOTIFICATION: Number.parseInt(env('LISTMONK_TX_ADMIN_NOTIFICATION', '0'), 10) || 0,
  TX_WAITLIST_PROMOTION: Number.parseInt(env('LISTMONK_TX_WAITLIST_PROMOTION', '0'), 10) || 0,
  TX_EVENT_REMINDER: Number.parseInt(env('LISTMONK_TX_EVENT_REMINDER', '0'), 10) || 0,
  TX_EVENT_MESSAGE: Number.parseInt(env('LISTMONK_TX_EVENT_MESSAGE', '0'), 10) || 0,
};

/** True when the listmonk admin API base is configured (URL + user + token). */
export function listmonkApiConfigured(): boolean {
  return config.LISTMONK_URL.length > 0 && config.LISTMONK_API_USER.length > 0 && config.LISTMONK_API_TOKEN.length > 0;
}

/** True when the newsletter list(s) are also configured. */
export function listmonkConfigured(): boolean {
  return listmonkApiConfigured() && config.LISTMONK_LIST_IDS.length > 0;
}

/** True when admin credentials are configured (the admin UI is usable). */
export function adminConfigured(): boolean {
  return config.ADMIN_EMAIL.length > 0 && config.ADMIN_PASSWORD.length > 0;
}
