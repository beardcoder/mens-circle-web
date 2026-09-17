/**
 * `GET /event/<slug>/card.png` — the Open Graph card for one evening.
 *
 * Deliberately NOT under /api/: robots.txt disallows that prefix, and
 * Facebook's crawler honours robots.txt. An og:image it is not allowed to
 * fetch is an og:image that does not exist, and the share would fall back to
 * a bare link.
 *
 * Two rules this route lives by:
 *
 *   1. It never fails into a broken image. Any error — a missing font, a
 *      satori throw, an unreadable record — serves the static 1200x630 poster
 *      with a 200 instead. A scraper that gets a 500 shows no picture at all,
 *      and WhatsApp remembers that for a long time.
 *   2. It answers fast, and it draws each card **once**. A render is ~165ms of
 *      largely synchronous CPU, and on a one-core box that is time the server
 *      spends not answering anything else. The renderer keeps the finished PNG
 *      (lib/server/og-card.ts), this route ships an ETag so a revalidation is a
 *      304, and a request carrying the current `?v=` token is `immutable` — so
 *      a scrape, a CDN and every re-check after it cost nothing. The versioned
 *      URL (see lib/event-meta.ts) is what makes all three safe: when the seat
 *      count changes, so does the URL, the token, the ETag and the cache key.
 */
import type { APIRoute } from 'astro';
import { getEventBySlug } from '@lib/server/events';
import { CARD_HEIGHT, CARD_WIDTH, cardContent, renderCard } from '@lib/server/og-card';
import { cardVersion, eventPlace, eventTimeRange } from '@lib/event-meta';

export const prerender = false;

/**
 * Cache-Control, by whether the request carries the URL this page currently
 * hands out.
 *
 * The `?v=` token is a hash of everything the card draws, so a request that
 * carries the current one can *never* mean a different picture — that is what
 * `immutable` is for, and it is what keeps Cloudflare, the scrapers and their
 * revalidations off the origin entirely. A missing or stale token is a link
 * from an older share: still answered, but only cached briefly, because its URL
 * says nothing about what it will draw.
 *
 * The old value was `max-age=86400, must-revalidate` with no validator, so
 * every cache came back a day later and paid for a full re-render.
 */
const FRESH_CACHE = 'public, max-age=31536000, immutable';
const STALE_CACHE = 'public, max-age=3600, must-revalidate';

/**
 * The failure path is a redirect, not a file read.
 *
 * `public/images/og-default.png` is a static asset the same server already
 * serves; pointing at it by URL needs no assumption about where the bundle
 * ended up on disk, which a `readFile` out of the server bundle would. Both
 * Facebook's and WhatsApp's crawlers follow a redirect on an image.
 */
const POSTER = '/images/og-default.png';

const headersFor = (cache: string, etag: string): Record<string, string> => ({
  'cache-control': cache,
  // A validator, so a revalidation is a 304 instead of another ~165ms render.
  etag,
  // Declared so a scraper can lay the card out before the bytes land.
  'x-image-width': String(CARD_WIDTH),
  'x-image-height': String(CARD_HEIGHT),
});

export const GET: APIRoute = async ({ params, request, url }) => {
  try {
    const event = params.slug ? await getEventBySlug(params.slug) : null;
    if (event) {
      const version = cardVersion(event);
      const etag = `"${version}"`;
      const cache = url.searchParams.get('v') === version ? FRESH_CACHE : STALE_CACHE;

      if (request.headers.get('if-none-match') === etag) {
        return new Response(null, { status: 304, headers: headersFor(cache, etag) });
      }

      const body = await renderCard(
        cardContent({
          title: event.title ?? '',
          eventDate: event.event_date,
          timeRange: eventTimeRange(event),
          place: eventPlace(event),
          isPast: event.is_past,
          isFull: event.is_full,
          availableSpots: event.available_spots,
          maxParticipants: event.max_participants,
        }),
      );
      return new Response(body as BodyInit, {
        status: 200,
        headers: { 'content-type': 'image/png', ...headersFor(cache, etag) },
      });
    }
  } catch {
    /* Fall through to the poster — never a 500 into a scraper. */
  }

  return new Response(null, {
    status: 302,
    headers: { location: POSTER, 'cache-control': 'public, max-age=300, must-revalidate' },
  });
};
