import type { APIRoute } from 'astro';

import { publicJson, readPublicEvents } from '@lib/server/public-data';

export const GET: APIRoute = ({ request }) => publicJson(request, 30, readPublicEvents);
