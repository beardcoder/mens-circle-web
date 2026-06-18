/**
 * Env-backed server configuration — the single source of truth for the backend
 * that replaced PocketBase. Pure data, no side effects, host-agnostic: the same
 * config object drives the Bun/SQLite default and any future target (D1,
 * Postgres, Resend, …) because the infrastructure adapters read from here.
 *
 * Read once at module load via `process.env` (available in the Bun runtime that
 * runs both `astro dev` and the production server bundle).
 */

function env(key: string, fallback = ''): string {
  const v = process.env[key];
  return v && v.length > 0 ? v : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return v === 'true' || v === '1';
}

/** Parse a comma-separated list of integers ("1,3,4") into a number array. */
export function parseIntList(raw: string): number[] {
  if (!raw) return [];
  const out: number[] = [];
  for (const part of raw.split(',')) {
    const token = part.trim();
    if (token === '') continue;
    const n = Number.parseInt(token, 10);
    if (Number.isNaN(n) || String(n) !== token) continue;
    out.push(n);
  }
  return out;
}

const DATA_DIR = env('DATA_DIR', './data').replace(/\/+$/, '');

export const config = {
  // ── App ──────────────────────────────────────────────────────────────────
  APP_URL: env(
    'APP_URL',
    env('PUBLIC_SITE_URL', 'https://mens-circle.de'),
  ).replace(/\/+$/, ''),
  SITE_NAME: env('SITE_NAME', 'Männerkreis Niederbayern/ Straubing'),

  // ── Storage ──────────────────────────────────────────────────────────────
  DATA_DIR,
  DB_PATH: env('DATABASE_PATH', `${DATA_DIR}/app.db`),
  UPLOAD_DIR: env('UPLOAD_DIR', `${DATA_DIR}/uploads`),

  // ── Mail (transactional event emails) ──────────────────────────────────────
  MAIL_FROM_ADDRESS: env('MAIL_FROM_ADDRESS', 'hallo@mens-circle.de'),
  MAIL_FROM_NAME: env('MAIL_FROM_NAME', 'Männerkreis Niederbayern/ Straubing'),
  MAIL_ADMIN_ADDRESS: env('MAIL_ADMIN_ADDRESS', 'hallo@mens-circle.de'),
  MAIL_ADMIN_NAME: env('MAIL_ADMIN_NAME', 'Männerkreis Admin'),
  CONTACT_EMAIL: env('MAIL_CONTACT_ADDRESS', 'hallo@mens-circle.de'),

  SMTP_HOST: env('SMTP_HOST'),
  SMTP_PORT: Number.parseInt(env('SMTP_PORT', '587'), 10),
  SMTP_USERNAME: env('SMTP_USERNAME'),
  SMTP_PASSWORD: env('SMTP_PASSWORD'),
  SMTP_TLS: envBool('SMTP_TLS', true),

  // ── Newsletter (listmonk) ──────────────────────────────────────────────────
  LISTMONK_URL: env('LISTMONK_URL').replace(/\/+$/, ''),
  LISTMONK_API_USER: env('LISTMONK_API_USER'),
  LISTMONK_API_TOKEN: env('LISTMONK_API_TOKEN'),
  LISTMONK_LIST_IDS: parseIntList(env('LISTMONK_LIST_IDS')),

  // ── Admin + internal auth ──────────────────────────────────────────────────
  ADMIN_EMAIL: env('ADMIN_EMAIL', env('PB_ADMIN_EMAIL')),
  ADMIN_PASSWORD: env('ADMIN_PASSWORD', env('PB_ADMIN_PASSWORD')),
  // Signs the admin session cookie. Falls back to a random per-boot secret
  // (sessions then drop on restart) — set it in production.
  SESSION_SECRET: env('SESSION_SECRET', crypto.randomUUID()),
  // Guards the internal cron endpoint (/api/internal/cron/*).
  CRON_SECRET: env('CRON_SECRET'),
} as const;

export type Config = typeof config;
