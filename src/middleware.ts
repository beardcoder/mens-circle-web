import { defineMiddleware } from 'astro:middleware';

import { cacheControlForRoute } from '@lib/cache-policy';

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

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Astro's own origin check, which EmDash switches off for the whole site (it guards
 * only its routes under /_emdash): a write from another site is refused before any
 * action or page sees it. Like EmDash's check it accepts the public origin
 * (`context.url`, from `siteUrl`) and the host the request was sent to.
 */
const crossSiteWrite = (request: Request, url: URL): boolean => {
  if (SAFE_METHODS.has(request.method) || url.pathname.startsWith('/_emdash/')) return false;

  const origin = request.headers.get('origin');

  if (!origin) return true;

  if (origin === url.origin) return false;

  return URL.canParse(origin) ? new URL(origin).host !== request.headers.get('host') : true;
};

/**
 * The CSRF guard and the cache policy of rendered responses. Runs inside the route cache (a hit is
 * served with the headers it stored) and only for matched routes: unknown paths
 * render the 404 page without it. EmDash guards its own admin (/_emdash).
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Images are optimised at build time; the server never runs sharp on request.
  if (import.meta.env.PROD && pathname === '/_image') return new Response(null, { status: 404 });

  if (crossSiteWrite(context.request, context.url)) {
    return new Response('Cross-site POST form submissions are forbidden', {
      status: 403,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  return withCacheControl(await next(), cacheControlForRoute(pathname));
});
