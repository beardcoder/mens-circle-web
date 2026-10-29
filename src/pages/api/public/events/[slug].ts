import type { APIRoute } from 'astro';

import { PublicDataError, publicEvent, publicJson, readPublicEvent } from '@lib/server/public-data';

export const GET: APIRoute = async ({ request, params, cache }) => {
  const response = await publicJson(request, async () => {
    const slug = params.slug ?? '';

    if (!slug) throw new PublicDataError(404, 'Dieser Termin wurde nicht gefunden.');

    return publicEvent(await readPublicEvent(slug));
  });

  cache.set(response.status === 200 ? { maxAge: 30, tags: ['events'] } : false);

  return response;
};
