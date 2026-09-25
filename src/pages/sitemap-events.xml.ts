/** The event pages, listed at request time. */
import type { APIRoute } from 'astro';
import { listPublishedEventsForSitemap } from '@lib/server/events';

export const prerender = false;

/** An unescaped `&` from a hand-set slug makes the whole document unparseable. */
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

  // A urlset with no children is valid, so an empty calendar yields an empty
  // sitemap rather than a 404 the crawler logs as an error.
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // An hour keeps crawlers current without a DB query per request.
      'cache-control': 'public, max-age=3600, must-revalidate',
    },
  });
};
