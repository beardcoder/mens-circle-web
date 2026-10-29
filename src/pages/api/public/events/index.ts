import type { APIRoute } from 'astro';

import { publicJson, readPublicEvents } from '@lib/server/public-data';

export const GET: APIRoute = async ({ request, cache }) => {
  const response = await publicJson(request, readPublicEvents);

  cache.set(response.status === 200 ? { maxAge: 30, tags: ['events'] } : false);

  return response;
};
