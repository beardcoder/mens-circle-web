import type { APIRoute } from 'astro';
import { clientIp, rateLimit } from '@lib/server/ratelimit';
import { submitTestimonial } from '@lib/server/testimonials';
import type { TestimonialPayload } from '@lib/types';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!rateLimit('testimonial', clientIp(request), 3, 3600)) {
    return Response.json(
      { success: false, message: 'Zu viele Anfragen. Bitte versuche es später erneut.' },
      { status: 429 },
    );
  }
  try {
    const payload = (await request.json()) as TestimonialPayload;
    const { status, body } = await submitTestimonial(payload);
    return Response.json(body, { status });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api] /api/testimonial/submit failed', String(err));
    return Response.json(
      { success: false, message: 'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.' },
      { status: 500 },
    );
  }
};
