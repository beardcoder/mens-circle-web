import { apiRoute } from '@lib/server/api';
import { submitTestimonial } from '@lib/server/testimonials';
import type { TestimonialPayload } from '@lib/types';

export const prerender = false;

export const POST = apiRoute('testimonial/submit', 'testimonial', 3, 3600, async (request) => {
  const payload = (await request.json()) as TestimonialPayload;
  const { status, body } = await submitTestimonial(payload);
  return Response.json(body, { status });
});
