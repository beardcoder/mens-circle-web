import { DEFAULT_RETENTION_DAYS } from '../shared/retention'
import { parseTrustedProxy } from './ratelimit'

type Env = Record<string, string | undefined>

const parseIntList = (raw: string): number[] =>
  raw
    ? String(raw)
        .split(',')
        .flatMap((part) => {
          const token = part.trim()

          if (!token) return []

          const n = Number.parseInt(token, 10)

          if (Number.isNaN(n) || String(n) !== token) {
            // eslint-disable-next-line no-console
            console.warn(
              `[config] ignoring non-numeric listmonk list id "${token}" — expected the numeric ID, not a UUID`,
            )

            return []
          }

          return [n]
        })
    : []

/**
 * The configuration an environment describes. Pure: tests pass their own `env`;
 * the app reads `process.env` once (`config` below).
 */
export function loadConfig(source: Env = process.env) {
  const env = (key: string, fallback = ''): string => {
    const v = source[key]

    return v && v.length > 0 ? v : fallback
  }

  const envInt = (key: string, fallback = 0) => Number.parseInt(env(key, String(fallback)), 10) || fallback

  return {
    APP_URL: env('APP_URL', env('PUBLIC_SITE_URL', 'https://mens-circle.de')).replace(/\/+$/, ''),
    /** Who hears of every new registration. */
    MAIL_ADMIN_ADDRESS: env('MAIL_ADMIN_ADDRESS', 'hallo@mens-circle.de'),
    CONTACT_EMAIL: env('MAIL_CONTACT_ADDRESS', 'hallo@mens-circle.de'),
    /** Days after an event until its registrations are anonymised (plugin cron); at most what /datenschutz names. */
    RETENTION_DAYS: Math.min(DEFAULT_RETENTION_DAYS, Math.max(1, envInt('RETENTION_DAYS', DEFAULT_RETENTION_DAYS))),
    /** `cloudflare` or `none` (default): whose header names the visitor's IP (ratelimit.ts). */
    TRUSTED_PROXY: parseTrustedProxy(env('TRUSTED_PROXY', 'none')),
    /**
     * Signs the cancel links in participant mails (cancel-token.ts). No fallback, never
     * a literal default: this repo is public, so a literal here is a published secret.
     */
    CANCEL_LINK_SECRET: env('CANCEL_LINK_SECRET', ''),
    LISTMONK_URL: env('LISTMONK_URL', '').replace(/\/+$/, ''),
    LISTMONK_API_USER: env('LISTMONK_API_USER', ''),
    LISTMONK_API_TOKEN: env('LISTMONK_API_TOKEN', ''),
    LISTMONK_LIST_IDS: parseIntList(env('LISTMONK_LIST_IDS', '')),
  }
}

export type Config = ReturnType<typeof loadConfig>

/** The app's configuration, from `process.env`; fields may be reassigned in tests. */
export const config: Config = loadConfig()

export const listmonkConfigured = (): boolean =>
  config.LISTMONK_URL.length > 0
  && config.LISTMONK_API_USER.length > 0
  && config.LISTMONK_API_TOKEN.length > 0
  && config.LISTMONK_LIST_IDS.length > 0
