import type { APIRoute } from 'astro';

import { PublicDataError, publicEvent, publicJson, readPublicEvent } from '@lib/server/public-data';

export const GET: APIRoute = ({ request, params }) =>
  publicJson(request, 30, async () => {
    const slug = params.slug ?? '';

    if (!slug) throw new PublicDataError(404, 'Dieser Termin wurde nicht gefunden.');

    return publicEvent(await readPublicEvent(slug));
  });
