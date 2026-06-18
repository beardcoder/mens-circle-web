/**
 * POST /api/event/register — public event registration with capacity/waitlist
 * handling, participant upsert and transactional emails. Same contract as the
 * former PocketBase custom route.
 */
import type { APIRoute } from 'astro';
import { getServices } from '../../../server/container';
import { isBot, isTruthy, json, readBody } from '../../../server/http';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const data = await readBody(request);

  const firstName = String(data.first_name ?? '').trim();
  const lastName = String(data.last_name ?? '').trim();
  const email = String(data.email ?? '')
    .trim()
    .toLowerCase();
  const phone = String(data.phone_number ?? '').trim();
  const eventId = String(data.event_id ?? '');

  // Honeypot: fake success so a bot thinks it won (no record, no email).
  if (isBot(data)) {
    return json(200, {
      success: true,
      message: `Vielen Dank, ${firstName}! Deine Anmeldung war erfolgreich. Du erhältst in Kürze eine Bestätigung per E-Mail.`,
    });
  }

  if (!isTruthy(data.privacy)) {
    return json(422, {
      success: false,
      message: 'Bitte bestätige die Datenschutzerklärung.',
    });
  }
  if (!email?.includes('@')) {
    return json(422, {
      success: false,
      message: 'Bitte gib eine gültige E-Mail-Adresse an.',
    });
  }
  if (!eventId) {
    return json(422, {
      success: false,
      message: 'Es wurde keine Veranstaltung angegeben.',
    });
  }

  try {
    const { registrations } = getServices();
    const result = await registrations.register({
      eventId,
      firstName,
      lastName,
      email,
      phone,
    });
    if (!result.ok)
      return json(result.code, { success: false, message: result.message });
    return json(200, { success: true, message: result.message });
  } catch (err) {
    console.error('/api/event/register failed', String(err));
    return json(500, {
      success: false,
      message:
        'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.',
    });
  }
};
