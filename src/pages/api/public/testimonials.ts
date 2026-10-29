import type { APIRoute } from 'astro';

import { publicJson, readPublicTestimonials } from '@lib/server/public-data';

export const GET: APIRoute = async ({ request, cache }) => {
  const response = await publicJson(request, readPublicTestimonials);

  cache.set(response.status === 200 ? { maxAge: 300, tags: ['testimonials'] } : false);

  return response;
};
