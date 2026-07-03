import { defineMiddleware } from 'astro:middleware';
import { readSession, SESSION_COOKIE } from './lib/server/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;

  // Canonicalise trailing slashes. The Bun adapter serves prerendered pages
  // from a static-file manifest that only registers the slash-less path
  // (`/atemuebung`), so the trailing-slash variant (`/atemuebung/`) falls
  // through and 404s instead of resolving. Redirect `/foo/` → `/foo` (301) so
  // inbound links — and any URLs Google still has with a trailing slash —
  // resolve to the single canonical form. Only GET/HEAD; the root stays as-is.
  //
  // Crucially, skip this while prerendering: with `build.format: 'directory'`
  // Astro renders each static page under its trailing-slash path (`/atemuebung/`)
  // at build time, so redirecting here would replace the page's real HTML with a
  // redirect-to-self stub (and Astro stamps those stubs `noindex`). `next()`
  // during prerender lets the real page render; the redirect still applies to
  // on-demand requests at runtime.
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
