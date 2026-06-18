/**
 * POST /api/testimonial/submit — public testimonial submission, always stored
 * unpublished for moderation. Same contract as the former PocketBase route.
 */
import type { APIRoute } from 'astro';
import { getServices } from '../../../server/container';
import { isBot, isTruthy, json, readBody } from '../../../server/http';

export const prerender = false;

const OK =
  'Vielen Dank! Dein Testimonial wurde eingereicht und wird nach Prüfung veröffentlicht.';

export const POST: APIRoute = async ({ request }) => {
  const data = await readBody(request);

  const quote = String(data.quote ?? '').trim();
  const authorName = String(data.author_name ?? '').trim();
  const role = String(data.role ?? '').trim();
  const email = String(data.email ?? '')
    .trim()
    .toLowerCase();

  if (isBot(data)) return json(200, { success: true, message: OK });

  if (!isTruthy(data.privacy)) {
    return json(422, {
      success: false,
      message: 'Bitte bestätige die Datenschutzerklärung.',
    });
  }
  if (quote.length < 10 || quote.length > 1000) {
    return json(422, {
      success: false,
      message: 'Dein Testimonial muss zwischen 10 und 1000 Zeichen lang sein.',
    });
  }
  if (email && !email.includes('@')) {
    return json(422, {
      success: false,
      message: 'Bitte gib eine gültige E-Mail-Adresse an.',
    });
  }

  try {
    const { testimonials } = getServices();
    await testimonials.submit({ quote, authorName, role, email });
    return json(200, { success: true, message: OK });
  } catch (err) {
    console.error('/api/testimonial/submit failed', String(err));
    return json(500, {
      success: false,
      message:
        'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.',
    });
  }
};
