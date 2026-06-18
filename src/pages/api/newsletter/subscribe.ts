/**
 * POST /api/newsletter/subscribe — forwards the sign-up to listmonk, which owns
 * the double opt-in, campaigns and unsubscribe. Same contract as before.
 */
import type { APIRoute } from 'astro';
import { isBot, json, readBody } from '../../../server/http';
import { listmonk } from '../../../server/infra/listmonk';

export const prerender = false;

const OK =
  'Vielen Dank! Du hast dich erfolgreich für unseren Newsletter angemeldet. Schau in dein Postfach.';

export const POST: APIRoute = async ({ request }) => {
  const data = await readBody(request);
  const email = String(data.email ?? '')
    .trim()
    .toLowerCase();
  const name = String(data.name ?? '').trim();

  if (isBot(data)) return json(200, { success: true, message: OK });

  if (!email?.includes('@')) {
    return json(422, {
      success: false,
      message: 'Bitte gib eine gültige E-Mail-Adresse an.',
    });
  }

  try {
    const result = await listmonk.subscribe(email, name);
    if (result.status === 'exists') {
      return json(409, {
        success: false,
        message:
          'Diese E-Mail-Adresse ist bereits für den Newsletter angemeldet.',
      });
    }
    if (!result.ok) {
      return json(502, {
        success: false,
        message:
          'Die Anmeldung ist momentan nicht möglich. Bitte versuche es später erneut.',
      });
    }
    return json(200, { success: true, message: OK });
  } catch (err) {
    console.error('/api/newsletter/subscribe failed', String(err));
    return json(500, {
      success: false,
      message:
        'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.',
    });
  }
};
