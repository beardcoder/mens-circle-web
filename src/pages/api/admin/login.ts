/** POST /api/admin/login — verify the env-configured admin and set the session. */
import type { APIRoute } from 'astro';
import {
  checkCredentials,
  createSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '../../../server/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');

  if (!checkCredentials(email, password)) {
    return redirect('/admin/login?error=1', 303);
  }
  cookies.set(
    SESSION_COOKIE,
    await createSession(email.trim()),
    sessionCookieOptions,
  );
  return redirect('/admin', 303);
};
