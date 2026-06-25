const env = (key: string, fallback = ''): string => {
  const v = process.env[key];
  return v && v.length > 0 ? v : fallback;
};

const envInt = (key: string, fallback = 0) =>
  Number.parseInt(env(key, String(fallback)), 10) || fallback;

export const parseIntList = (raw: string): number[] =>
  raw
    ? String(raw)
        .split(',')
        .flatMap((part) => {
          const token = part.trim();
          if (!token) return [];
          const n = Number.parseInt(token, 10);
          if (Number.isNaN(n) || String(n) !== token) {
            // eslint-disable-next-line no-console
            console.warn(`[config] ignoring non-numeric listmonk list id "${token}" — expected the numeric ID, not a UUID`);
            return [];
          }
          return [n];
        })
    : [];

export const config = {
  APP_URL: env('APP_URL', env('PUBLIC_SITE_URL', 'https://mens-circle.de')).replace(/\/+$/, ''),
  SITE_NAME: env('SITE_NAME', 'Männerkreis Niederbayern/ Straubing'),
  MAIL_FROM_ADDRESS: env('MAIL_FROM_ADDRESS', 'hallo@mens-circle.de'),
  MAIL_FROM_NAME: env('MAIL_FROM_NAME', 'Männerkreis Niederbayern/ Straubing'),
  MAIL_ADMIN_ADDRESS: env('MAIL_ADMIN_ADDRESS', 'hallo@mens-circle.de'),
  MAIL_ADMIN_NAME: env('MAIL_ADMIN_NAME', 'Männerkreis Admin'),
  CONTACT_EMAIL: env('MAIL_CONTACT_ADDRESS', 'hallo@mens-circle.de'),
  DATABASE_PATH: env('DATABASE_PATH', './data/mens-circle.db'),
  ADMIN_EMAIL: env('ADMIN_EMAIL', ''),
  ADMIN_PASSWORD: env('ADMIN_PASSWORD', ''),
  ADMIN_SESSION_SECRET: env('ADMIN_SESSION_SECRET', env('ADMIN_PASSWORD', 'change-me')),
  LISTMONK_URL: env('LISTMONK_URL', '').replace(/\/+$/, ''),
  LISTMONK_API_USER: env('LISTMONK_API_USER', ''),
  LISTMONK_API_TOKEN: env('LISTMONK_API_TOKEN', ''),
  LISTMONK_LIST_IDS: parseIntList(env('LISTMONK_LIST_IDS', '')),
  CAMPAIGN_TEMPLATE_ID: envInt('LISTMONK_CAMPAIGN_TEMPLATE_ID'),
  TX_REGISTRATION_CONFIRMATION: envInt('LISTMONK_TX_REGISTRATION_CONFIRMATION'),
  TX_WAITLIST_CONFIRMATION: envInt('LISTMONK_TX_WAITLIST_CONFIRMATION'),
  TX_ADMIN_NOTIFICATION: envInt('LISTMONK_TX_ADMIN_NOTIFICATION'),
  TX_WAITLIST_PROMOTION: envInt('LISTMONK_TX_WAITLIST_PROMOTION'),
  TX_EVENT_REMINDER: envInt('LISTMONK_TX_EVENT_REMINDER'),
  TX_EVENT_MESSAGE: envInt('LISTMONK_TX_EVENT_MESSAGE'),
};

export const listmonkApiConfigured = (): boolean =>
  config.LISTMONK_URL.length > 0 && config.LISTMONK_API_USER.length > 0 && config.LISTMONK_API_TOKEN.length > 0;

export const listmonkConfigured = (): boolean =>
  listmonkApiConfigured() && config.LISTMONK_LIST_IDS.length > 0;

export const adminConfigured = (): boolean =>
  config.ADMIN_EMAIL.length > 0 && config.ADMIN_PASSWORD.length > 0;
