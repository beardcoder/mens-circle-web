/** `GET /auth/login` — starts the Pocket ID sign-in. */
import type { APIRoute } from 'astro';

import { config } from '@lib/server/config';
import { beginLogin, FLOW_COOKIE, FLOW_TTL_S, oidcConfigured } from '@lib/server/oidc';
import { clientIp, peerAddress, rateLimit } from '@lib/server/ratelimit';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { cookies, redirect, request, url } = context;

  if (!oidcConfigured()) return redirect('/admin/login?error=config', 302);

  const ip = clientIp(request, peerAddress(context), config.TRUSTED_PROXY);

  if (!rateLimit('admin-login', ip, 20, 600)) return redirect('/admin/login?error=rate', 302);

  try {
    const flow = await beginLogin(url.searchParams.get('redirect') ?? '/admin');

    cookies.set(FLOW_COOKIE, flow.cookie, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      // Lax, not Strict: the provider's redirect back is a cross-site top-level
      // navigation, and Strict would withhold the cookie on exactly that request.
      sameSite: 'lax',
      path: '/auth',
      maxAge: FLOW_TTL_S,
    });

    return redirect(flow.url, 302);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auth] could not start the Pocket ID sign-in', err);

    return redirect('/admin/login?error=provider', 302);
  }
};
