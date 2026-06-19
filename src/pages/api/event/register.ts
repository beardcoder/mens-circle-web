import type { APIRoute } from 'astro';
import { register } from '@lib/server/registrations';
import { clientIp, rateLimit } from '@lib/server/ratelimit';
import type { RegistrationPayload } from '@lib/types';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!rateLimit('event-register', clientIp(request), 5, 3600)) {
    return Response.json(
      { success: false, message: 'Zu viele Anfragen. Bitte versuche es später erneut.' },
      { status: 429 },
    );
  }
  try {
    const payload = (await request.json()) as RegistrationPayload;
    const { status, body } = await register(payload);
    return Response.json(body, { status });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api] /api/event/register failed', String(err));
    return Response.json(
      { success: false, message: 'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.' },
      { status: 500 },
    );
  }
};
