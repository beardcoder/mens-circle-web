import { defineMiddleware } from 'astro:middleware';

import { cacheControlForRoute } from '@lib/cache-policy';
import { readSession, SESSION_COOKIE } from '@lib/server/auth';

const isAdminPage = (pathname: string): boolean =>
  (pathname === '/admin' || pathname.startsWith('/admin/')) && pathname !== '/admin/login';

/** Adds the policy unless the route set its own; copies immutable (redirect) responses. */
const withCacheControl = (response: Response, value: string): Response => {
  if (response.headers.has('Cache-Control')) return response;

  try {
    response.headers.set('Cache-Control', value);

    return response;
  } catch {
    const headers = new Headers(response.headers);

    headers.set('Cache-Control', value);

    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};

/**
 * The admin guard and the cache policy of rendered responses. Runs inside the route
 * cache (a hit is served with the headers it stored) and only for matched routes:
 * unknown paths render the 404 page without it.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const policy = cacheControlForRoute(pathname);

  if (isAdminPage(pathname)) {
    const admin = await readSession(context.cookies.get(SESSION_COOKIE)?.value);

    if (!admin) {
      return withCacheControl(context.redirect(`/admin/login?redirect=${encodeURIComponent(pathname)}`, 302), policy);
    }

    context.locals.admin = admin;
  }

  return withCacheControl(await next(), policy);
});
