/**
 * The site's one cache policy, read by src/middleware.ts (rendered responses)
 * and astro-integrations/static-cache-headers.mjs (files on disk).
 */

export const CACHE_CONTROL = 'Cache-Control';

/** Admin, server islands, actions: never stored anywhere. */
const NO_STORE = 'private, no-store';
/** HTML: may be stored, revalidated before reuse. */
const REVALIDATE = 'public, max-age=0, must-revalidate';
/** Unhashed `public/` files; not immutable because a replaced file keeps its name. */
const PUBLIC_ASSET = 'public, max-age=604800, stale-while-revalidate=2592000';
const SHORT = 'public, max-age=3600, must-revalidate';
/** `sw.js` only unregisters the old service worker; a cached copy could not retire itself. */
const NO_CACHE = 'no-cache';

const isPrivatePath = (pathname: string): boolean =>
  pathname === '/admin' ||
  pathname.startsWith('/admin/') ||
  pathname.startsWith('/_server-islands/') ||
  pathname.startsWith('/_actions/');

/** Routes that set their own Cache-Control never reach this. */
export const cacheControlForRoute = (pathname: string): string => (isPrivatePath(pathname) ? NO_STORE : REVALIDATE);

const UNHASHED_ASSET = /\.(?:png|jpe?g|gif|svg|ico|webp|avif|woff2?)$/;

/** `null` keeps the entry as is: hashed assets stay immutable, generated files keep their own policy. */
export function cacheControlForFile(pathname: string, assetsPrefix: string): string | null {
  if (pathname.startsWith(`/${assetsPrefix}/`)) return null;
  if (pathname === '/sw.js') return NO_CACHE;
  if (pathname === '/robots.txt' || pathname === '/manifest.webmanifest') return SHORT;
  return UNHASHED_ASSET.test(pathname) ? PUBLIC_ASSET : null;
}
