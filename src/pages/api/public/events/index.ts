/** GET /api/public/events — all published events (past + upcoming) as DTOs. */
import type { APIRoute } from 'astro';
import { getServices } from '../../../../server/container';
import { json } from '../../../../server/http';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const { events } = getServices();
    return json(200, { events: await events.listPublished() });
  } catch (err) {
    console.error('/api/public/events failed', String(err));
    return json(200, { events: [] });
  }
};
