/** The event pages, listed at request time. */
import type { APIRoute } from 'astro';

import { listPublishedEventsForSitemap } from '@lib/server/events';
import { escapeHtml } from '@lib/server/format';
import { PUBLIC_CACHE } from '@lib/server/public-data';

export const prerender = false;

/** W3C-datetime for `<lastmod>`; falls back to the raw value if unparseable. */
const lastmod = (iso: string): string => {
  const d = new Date(iso);

  return Number.isNaN(d.getTime()) ? iso : d.toISOString();
};

export const GET: APIRoute = async ({ site, cache }) => {
  const events = await listPublishedEventsForSitemap();

  cache.set(PUBLIC_CACHE);

  const urls = events
    .map((event) => {
      // An unescaped `&` from a hand-set slug would make the whole document unparseable.
      const loc = escapeHtml(new URL(`/event/${event.slug}`, site).href);

      return `<url><loc>${loc}</loc><lastmod>${lastmod(event.updatedAt)}</lastmod></url>`;
    })
    .join('');

  // A urlset with no children is valid, so an empty calendar yields an empty
  // sitemap rather than a 404 the crawler logs as an error.
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // The route cache spares the database; crawlers may keep it an hour.
      'cache-control': 'public, max-age=3600, must-revalidate',
    },
  });
};
