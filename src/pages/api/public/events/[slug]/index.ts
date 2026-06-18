/** GET /api/public/events/{slug} — a single published event as a DTO (404 if missing). */
import type { APIRoute } from 'astro';
import { getServices } from '../../../../../server/container';
import { json } from '../../../../../server/http';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const { events } = getServices();
    const event = params.slug ? await events.bySlug(params.slug) : null;
    if (!event) return json(404, { event: null });
    return json(200, { event });
  } catch (err) {
    console.error('/api/public/events/{slug} failed', String(err));
    return json(404, { event: null });
  }
};
