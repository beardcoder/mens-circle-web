import type { APIRoute } from 'astro';
import { getEventBySlug } from '@lib/server/events';

export const prerender = false;

// GET /api/public/events/{slug} — a single published event as a public DTO.
export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug;
  if (!slug) return Response.json({ event: null }, { status: 404 });
  const event = await getEventBySlug(slug);
  if (!event) return Response.json({ event: null }, { status: 404 });
  return Response.json({ event });
};
