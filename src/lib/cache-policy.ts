/**
 * The cache policy of rendered responses, applied by src/middleware.ts unless a route
 * sets its own. Static files keep the Node adapter's: hashed assets immutable, the
 * rest revalidated by ETag.
 */

/** Admin, sign-in, actions and server islands: never stored anywhere. */
const PRIVATE = /^\/(?:admin|auth|_actions|_server-islands)(?:\/|$)/;

/** Public HTML and JSON may be stored, but are revalidated before reuse. */
const REVALIDATE = 'public, max-age=0, must-revalidate';

export const cacheControlForRoute = (pathname: string): string =>
  PRIVATE.test(pathname) ? 'private, no-store' : REVALIDATE;
