import type { APIRoute } from 'astro';

import { publicJson, readPublicTestimonials } from '@lib/server/public-data';

export const GET: APIRoute = ({ request }) => publicJson(request, 300, readPublicTestimonials);
