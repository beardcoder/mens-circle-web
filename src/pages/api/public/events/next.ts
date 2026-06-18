/** GET /api/public/events/next — the next upcoming published event (or null). */
import type { APIRoute } from 'astro';
import { getServices } from '../../../../server/container';
import { json } from '../../../../server/http';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const { events } = getServices();
    return json(200, { event: await events.nextEvent() });
  } catch (err) {
    console.error('/api/public/events/next failed', String(err));
    return json(200, { event: null });
  }
};
