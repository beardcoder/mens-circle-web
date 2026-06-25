import { defineMiddleware } from 'astro:middleware';
import { readSession, SESSION_COOKIE } from './lib/server/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApi = pathname.startsWith('/api/admin/');
  const isLogin = pathname === '/admin/login' || pathname === '/api/admin/login';

  if ((isAdminPage || isAdminApi) && !isLogin) {
    const token = context.cookies.get(SESSION_COOKIE)?.value;
    const email = await readSession(token);
    if (!email) {
      if (isAdminApi) {
        return new Response(JSON.stringify({ success: false, message: 'Nicht angemeldet.' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }
      return context.redirect(`/admin/login?redirect=${encodeURIComponent(pathname)}`, 302);
    }
    context.locals.admin = email;
  }

  return next();
});
