/**
 * `GET /auth/callback` — Pocket ID sends the browser back here. Register
 * exactly `${APP_URL}/auth/callback` as the client's callback URL.
 */
import type { APIRoute } from 'astro';
import { createSession, SESSION_COOKIE, SESSION_TTL_S } from '@lib/server/auth';
import { AccessDenied, completeLogin, FLOW_COOKIE } from '@lib/server/oidc';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect, url }) => {
  const flowCookie = cookies.get(FLOW_COOKIE)?.value;
  cookies.delete(FLOW_COOKIE, { path: '/auth' });

  // The user cancelled at the provider, or the provider refused.
  if (url.searchParams.has('error')) return redirect('/admin/login?error=cancelled', 302);

  try {
    const { email, redirect: target } = await completeLogin(url.search, flowCookie);
    cookies.set(SESSION_COOKIE, await createSession(email), {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_S,
    });
    return redirect(target, 302);
  } catch (err) {
    const denied = err instanceof AccessDenied;
    // eslint-disable-next-line no-console
    console.error('[auth] Pocket ID sign-in failed', err);
    return redirect(`/admin/login?error=${denied ? 'denied' : 'failed'}`, 302);
  }
};
