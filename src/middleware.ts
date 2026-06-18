/**
 * Auth middleware — protects the slim admin (`/admin/*`) and its action
 * endpoints (`/api/admin/*`) behind the signed session cookie. The login routes
 * stay public; everything else under those prefixes requires a valid session.
 */
import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, verifySession } from './server/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApi = pathname.startsWith('/api/admin/');

  if (!isAdminPage && !isAdminApi) return next();

  const email = await verifySession(context.cookies.get(SESSION_COOKIE)?.value);
  context.locals.admin = email ?? undefined;

  const isLoginPage = pathname === '/admin/login';
  const isLoginApi = pathname === '/api/admin/login';

  if (!email) {
    if (isLoginPage || isLoginApi) return next();
    if (isAdminApi) return new Response('Unauthorized', { status: 401 });
    return context.redirect('/admin/login', 302);
  }

  // Already signed in → keep them out of the login page.
  if (isLoginPage) return context.redirect('/admin', 302);

  return next();
});
