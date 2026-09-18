import type { APIContext } from 'astro';
import { defineMiddleware } from 'astro:middleware';
import { readSession, SESSION_COOKIE } from './lib/server/auth';

/** Retired URLs whose closest page is the home page — the breathing exercise and its app are gone. */
const HOME_ALIASES = new Set(['/home', '/atemuebung', '/atemuebung/app']);

/**
 * The adapter's static manifest only registers the slash-less path, so
 * `/impressum/` would 404. Skipped while prerendering: with
 * `build.format: 'directory'` Astro renders each static page under its
 * trailing-slash path, and redirecting would replace the HTML with a stub.
 */
const hasTrailingSlash = ({ isPrerendered, request, url }: APIContext): boolean =>
  !isPrerendered &&
  (request.method === 'GET' || request.method === 'HEAD') &&
  url.pathname !== '/' &&
  url.pathname.endsWith('/');

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;

  if (hasTrailingSlash(context)) {
    return context.redirect(`${pathname.replace(/\/+$/, '') || '/'}${search}`, 301);
  }

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
});
