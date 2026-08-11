/**
 * `GET /sitemap-events.xml` — the event pages, listed at request time.
 *
 * `@astrojs/sitemap` only sees routes that exist at build time, and `/event/<slug>`
 * does not: the slugs live in SQLite and adding an event publishes a page with no
 * rebuild. So this sitemap is a route, not a build artefact — it queries the DB
 * per request and `astro-integrations/sitemap-index-extra.mjs` links it from the
 * index that robots.txt advertises.
 *
 * Deliberately NOT under /api/, which robots.txt disallows.
 */
import type { APIRoute } from 'astro';
import { listPublishedEventsForSitemap } from '@lib/server/events';

export const prerender = false;

/** XML text escaping. Slugs are date-derived today, but a hand-set slug could
 *  contain anything, and an unescaped `&` makes the whole document unparseable. */
const xml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** W3C-datetime for `<lastmod>`; falls back to the raw value if unparseable. */
const lastmod = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString();
};

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://mens-circle.de');
  const events = await listPublishedEventsForSitemap();

  const urls = events
    .map((event) => {
      const loc = xml(new URL(`/event/${event.slug}`, base).href);
      return `<url><loc>${loc}</loc><lastmod>${lastmod(event.updatedAt)}</lastmod></url>`;
    })
    .join('');

  // A urlset with zero <url> children is still valid, so an empty calendar
  // yields an empty sitemap rather than a 404 the crawler would log as an error.
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // Crawlers re-fetch sitemaps often; an hour keeps them current without
      // putting a DB query behind every request.
      'cache-control': 'public, max-age=3600, must-revalidate',
    },
  });
};
