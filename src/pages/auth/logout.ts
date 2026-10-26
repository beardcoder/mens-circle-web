/** `POST /auth/logout` — a plain form post, so signing out never waits on a hydrated island. */
import type { APIRoute } from 'astro';

import { SESSION_COOKIE } from '@lib/server/auth';

export const prerender = false;

export const POST: APIRoute = ({ cookies, redirect }) => {
  // The same attributes as at sign-in (auth/callback.ts), so every browser drops it.
  cookies.delete(SESSION_COOKIE, { httpOnly: true, secure: import.meta.env.PROD, sameSite: 'lax', path: '/' });

  return redirect('/admin/login', 303);
};
