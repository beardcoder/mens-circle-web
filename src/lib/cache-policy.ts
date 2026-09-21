/**
 * The site's one cache policy.
 *
 * Two consumers read this table, so a path cannot be filed under two different
 * rules:
 *
 *   • src/middleware.ts                            everything rendered on demand
 *   • astro-integrations/static-cache-headers.mjs  everything served from disk
 *
 * Production sits behind Cloudflare, which compresses (brotli) and caches the
 * hashed `/assets/*` bundles, but reports `DYNAMIC` for every HTML route — it
 * does not cache documents. So these headers speak to browsers first and to any
 * shared cache second, and they have to be right on their own rather than
 * relying on an edge configuration this repository does not own.
 */

export const CACHE_CONTROL = 'Cache-Control';

/**
 * Back-office pages, the live server islands and action responses. A seat
 * count, a participant list or a signed-in view must never be stored — not by
 * the browser, not by an intermediary, not by a future edge cache rule.
 */
export const NO_STORE = 'private, no-store';

/**
 * HTML. May be stored, must be revalidated before every reuse.
 *
 * Prerendered documents carry the adapter's ETag, so a repeat visit costs one
 * conditional request and a 304 rather than the whole document. On-demand
 * routes have no validator, so this simply keeps a live seat count from being
 * served stale. The uniform rule replaces a 24h `max-age` that left Impressum
 * and Datenschutz a day behind the repository.
 */
export const REVALIDATE = 'public, max-age=0, must-revalidate';

/**
 * Unhashed files from `public/` — favicons, logos, the OG poster. Their names
 * carry no hash, so `immutable` would strand a replaced file in caches
 * forever; a week of freshness plus a month of background refresh keeps them
 * out of the request path without that risk.
 */
export const PUBLIC_ASSET = 'public, max-age=604800, stale-while-revalidate=2592000';

/** Crawler- and installer-facing files, which have to be able to change today. */
export const SHORT = 'public, max-age=3600, must-revalidate';

/**
 * `public/sw.js` only. It exists to unregister the retired breathing app's
 * service worker, so it must never be pinned in a cache — a stale copy is a
 * worker that cannot retire itself.
 */
export const NO_CACHE = 'no-cache';

/** Nothing here may be stored; see `NO_STORE`. */
const isPrivatePath = (pathname: string): boolean =>
  pathname === '/admin' ||
  pathname.startsWith('/admin/') ||
  pathname.startsWith('/_server-islands/') ||
  pathname.startsWith('/_actions/');

/**
 * The policy for a response the server renders. Routes that set their own
 * `Cache-Control` (`/health`, `/sitemap-events.xml`, the home page's
 * island-parameter `no-cache`) are left alone by the middleware and never
 * reach this function.
 */
export const cacheControlForRoute = (pathname: string): string => (isPrivatePath(pathname) ? NO_STORE : REVALIDATE);

/** Files whose bytes are addressed by name alone, so they cannot be immutable. */
const UNHASHED_ASSET = /\.(?:png|jpe?g|gif|svg|ico|webp|avif|woff2?)$/;

/**
 * The policy for a file in the adapter's static manifest, or `null` to leave
 * the entry as the adapter and the other integrations wrote it.
 *
 * `null` is the answer for two groups on purpose: the hashed bundles under
 * `assetsPrefix`, which are already `immutable` and must stay that way, and
 * the generated sitemaps, `llms.txt` and markdown, which
 * publish-generated-files.mjs gives their own hour-long policy.
 */
export function cacheControlForFile(pathname: string, assetsPrefix: string): string | null {
  if (pathname.startsWith(`/${assetsPrefix}/`)) return null;
  if (pathname === '/sw.js') return NO_CACHE;
  if (pathname === '/robots.txt' || pathname === '/manifest.webmanifest') return SHORT;
  return UNHASHED_ASSET.test(pathname) ? PUBLIC_ASSET : null;
}
