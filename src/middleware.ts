import { defineMiddleware } from 'astro:middleware';
import { readSession, SESSION_COOKIE } from './lib/server/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;

  // The adapter's static manifest only registers the slash-less path, so
  // `/atemuebung/` would 404. Skipped while prerendering: with
  // `build.format: 'directory'` Astro renders each static page under its
  // trailing-slash path, and redirecting would replace the HTML with a stub.
  const method = context.request.method;
  if (!context.isPrerendered && (method === 'GET' || method === 'HEAD') && pathname !== '/' && pathname.endsWith('/')) {
    const normalized = pathname.replace(/\/+$/, '') || '/';
    return context.redirect(`${normalized}${search}`, 301);
  }

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
