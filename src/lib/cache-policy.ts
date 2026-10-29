/**
 * The site's one cache policy, read by src/middleware.ts (rendered responses)
 * for rendered pages; the Node adapter handles static assets.
 */

export const CACHE_CONTROL = 'Cache-Control';

/** Admin, server islands, actions: never stored anywhere. */
const NO_STORE = 'private, no-store';
/** HTML: may be stored, revalidated before reuse. */
const REVALIDATE = 'public, max-age=0, must-revalidate';

/**
 * The prerendered documents (legal pages, personal page,
 * testimonial form) set this themselves. Browsers revalidate (the HTML names per-build assets); a
 * shared cache may serve it for 5 minutes. None of them holds live data.
 */
export const PRERENDERED_CACHE_CONTROL = 'public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=60';

const isPrivatePath = (pathname: string): boolean =>
  pathname === '/admin' ||
  pathname.startsWith('/admin/') ||
  pathname.startsWith('/_server-islands/') ||
  pathname.startsWith('/_actions/');

/** Routes that set their own Cache-Control never reach this. */
export const cacheControlForRoute = (pathname: string): string => (isPrivatePath(pathname) ? NO_STORE : REVALIDATE);
