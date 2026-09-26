import type { APIContext, MiddlewareNext } from 'astro';
import { defineMiddleware } from 'astro:middleware';
import { CACHE_CONTROL, cacheControlForRoute } from './lib/cache-policy';
import { readSession, SESSION_COOKIE } from './lib/server/auth';

/** Retired URLs whose closest page is the home page — the breathing exercise and its app are gone. */
const HOME_ALIASES = new Set(['/home', '/atemuebung', '/atemuebung/app']);

/** Adds the cache policy unless the route set its own; copies immutable (redirect) responses. */
const withCacheControl = (response: Response, value: string): Response => {
  if (response.headers.has(CACHE_CONTROL)) return response;
  try {
    response.headers.set(CACHE_CONTROL, value);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    headers.set(CACHE_CONTROL, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};

/** Retired URLs, the admin guard, and otherwise the route itself. */
const handle = async (context: APIContext, next: MiddlewareNext): Promise<Response> => {
  const { pathname } = context.url;

  if (HOME_ALIASES.has(pathname)) return context.redirect('/', 301);

  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isLogin = pathname === '/admin/login';

  if (isAdminPage && !isLogin) {
    const token = context.cookies.get(SESSION_COOKIE)?.value;
    const email = await readSession(token);
    if (!email) {
      return context.redirect(`/admin/login?redirect=${encodeURIComponent(pathname)}`, 302);
    }
    context.locals.admin = email;
  }

  return next();
};

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await handle(context, next);
  return withCacheControl(response, cacheControlForRoute(context.url.pathname));
});
