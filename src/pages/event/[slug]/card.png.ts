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
 *   2. It answers fast. WhatsApp and Facebook give a preview fetch a short
 *      budget; ~180ms of render plus a long cache is inside it, and the
 *      versioned URL (see lib/event-meta.ts) means a cached copy is never
 *      stale — when the seat count changes, so does the URL.
 */
import type { APIRoute } from 'astro';
import { getEventBySlug } from '@lib/server/events';
import { CARD_HEIGHT, CARD_WIDTH, cardContent, renderCard } from '@lib/server/og-card';
import { eventPlace, eventTimeRange } from '@lib/event-meta';

export const prerender = false;

/**
 * The failure path is a redirect, not a file read.
 *
 * `public/images/og-default.png` is a static asset the same server already
 * serves; pointing at it by URL needs no assumption about where the bundle
 * ended up on disk, which a `readFile` out of the server bundle would. Both
 * Facebook's and WhatsApp's crawlers follow a redirect on an image.
 */
const POSTER = '/images/og-default.png';

const png = (body: Uint8Array, cache: string): Response =>
  new Response(body as BodyInit, {
    status: 200,
    headers: {
      'content-type': 'image/png',
      'cache-control': cache,
      // Declared so a scraper can lay the card out before the bytes land.
      'x-image-width': String(CARD_WIDTH),
      'x-image-height': String(CARD_HEIGHT),
    },
  });

export const GET: APIRoute = async ({ params }) => {
  try {
    const event = params.slug ? await getEventBySlug(params.slug) : null;
    if (event) {
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
      // A day of caching, and the URL carries a version of the seat state, so
      // a filling evening gets a new URL rather than a stale picture.
      return png(body, 'public, max-age=86400, must-revalidate');
    }
  } catch {
    /* Fall through to the poster — never a 500 into a scraper. */
  }

  return new Response(null, {
    status: 302,
    headers: { location: POSTER, 'cache-control': 'public, max-age=300, must-revalidate' },
  });
};
