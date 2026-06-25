import { apiRoute } from '@lib/server/api';
import { subscribeToNewsletter } from '@lib/server/listmonk';

export const prerender = false;

const SUCCESS_MSG = 'Vielen Dank! Du hast dich erfolgreich für unseren Newsletter angemeldet. Schau in dein Postfach.';

export const POST = apiRoute('newsletter/subscribe', 'newsletter', 5, 3600, async (request) => {
  const data = (await request.json()) as { email?: string; name?: string; website?: string };
  const email = (data.email || '').trim().toLowerCase();
  const name = (data.name || '').trim();

  if (typeof data.website === 'string' && data.website.trim() !== '') {
    return Response.json({ success: true, message: SUCCESS_MSG });
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
  return Response.json({ success: true, message: SUCCESS_MSG });
});
