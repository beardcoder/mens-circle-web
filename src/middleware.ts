/**
 * Request middleware.
 *
 *  • Boots the reminder cron once, lazily, at runtime (the server is
 *    long-lived). The import is dynamic and gated on a runtime flag set by the
 *    server entry, so the build-time prerender never pulls in the `bun:sqlite`
 *    data layer.
 *  • Guards the admin UI (/admin/*) and admin API (/api/admin/*) behind the
 *    signed session cookie; unauthenticated page hits redirect to the login,
 *    API hits get a 401.
 */
import { defineMiddleware } from 'astro:middleware';
import { readSession, SESSION_COOKIE } from './lib/server/auth';

let cronStarted = false;
async function ensureCron(): Promise<void> {
  if (cronStarted) return;
  // Only at runtime (set in adapter/server.mjs) — never during the build.
  if (!(globalThis as unknown as { __MC_RUNTIME?: boolean }).__MC_RUNTIME) return;
  cronStarted = true;
  try {
    const { startReminderCron } = await import('./lib/server/cron');
    startReminderCron();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[cron] failed to start', err);
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  void ensureCron();

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
