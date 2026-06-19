import type { APIRoute } from 'astro';
import { subscribeToNewsletter } from '@lib/server/listmonk';
import { clientIp, rateLimit } from '@lib/server/ratelimit';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!rateLimit('newsletter', clientIp(request), 5, 3600)) {
    return Response.json(
      { success: false, message: 'Zu viele Anfragen. Bitte versuche es später erneut.' },
      { status: 429 },
    );
  }
  try {
    const data = (await request.json()) as { email?: string; name?: string; website?: string };
    const email = (data.email || '').trim().toLowerCase();
    const name = (data.name || '').trim();

    // Honeypot — fake success silently.
    if (typeof data.website === 'string' && data.website.trim() !== '') {
      return Response.json({
        success: true,
        message: 'Vielen Dank! Du hast dich erfolgreich für unseren Newsletter angemeldet. Schau in dein Postfach.',
      });
    }

    if (!email || !email.includes('@')) {
      return Response.json({ success: false, message: 'Bitte gib eine gültige E-Mail-Adresse an.' }, { status: 422 });
    }

    const result = await subscribeToNewsletter(email, name);
    if (result.status === 'exists') {
      return Response.json(
        { success: false, message: 'Diese E-Mail-Adresse ist bereits für den Newsletter angemeldet.' },
        { status: 409 },
      );
    }
    if (!result.ok) {
      return Response.json(
        { success: false, message: 'Die Anmeldung ist momentan nicht möglich. Bitte versuche es später erneut.' },
        { status: 502 },
      );
    }
    return Response.json({
      success: true,
      message: 'Vielen Dank! Du hast dich erfolgreich für unseren Newsletter angemeldet. Schau in dein Postfach.',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api] /api/newsletter/subscribe failed', String(err));
    return Response.json(
      { success: false, message: 'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.' },
      { status: 500 },
    );
  }
};
