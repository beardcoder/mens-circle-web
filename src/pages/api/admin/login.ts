import type { APIRoute } from 'astro';
import { createSession, SESSION_COOKIE, verifyCredentials } from '@lib/server/auth';
import { clientIp, rateLimit } from '@lib/server/ratelimit';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!rateLimit('admin-login', clientIp(request), 10, 600)) {
    return Response.json({ success: false, message: 'Zu viele Versuche. Bitte später erneut.' }, { status: 429 });
  }
  try {
    const { email, password } = (await request.json()) as { email?: string; password?: string };
    if (!verifyCredentials(email || '', password || '')) {
      return Response.json({ success: false, message: 'E-Mail oder Passwort ist falsch.' }, { status: 401 });
    }
    const token = await createSession((email || '').trim().toLowerCase());
    cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
    return Response.json({ success: true, message: 'Angemeldet.' });
  } catch {
    return Response.json({ success: false, message: 'Anmeldung fehlgeschlagen.' }, { status: 400 });
  }
};
