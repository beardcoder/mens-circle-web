# Public data and route cache

## Live seats

One same-origin GET endpoint, no authentication or cookies. It feeds the client-only
registration island on an event page; everything else on the public pages is in the
server-rendered HTML. No participant records, email addresses or precise meeting-address
fields are returned. The TypeScript contract is `PublicEvent` in
`src/components/event/types.ts`.

| Route                       | 200 response                                                                   |
| --------------------------- | ------------------------------------------------------------------------------ |
| `/api/public/events/{slug}` | `PublicEvent`: id, slug, display view, availableSpots, maxParticipants, isPast |

Failures return `{ message: string }` with `Cache-Control: no-store`: 404 for an
unknown or unpublished event, 503 when the database cannot be read. A failed read is
never stored. Successes are `public, max-age=0, must-revalidate`.

The island starts from the snapshot the page was rendered with and reads the endpoint
again only when the page comes back into view after 30 seconds (`usePublicData`). There
is no preload, no polling and no cache-busting query. The registration action checks
availability in its own database transaction; a displayed count never reserves a seat.

`/api/public/events/{slug}/ics` is the calendar file linked from confirmation mails; it
carries the full address.

## Route cache

Astro's `memoryCache()` holds complete responses in the one server process: home,
`/event`, every event page, the endpoint above and `/sitemap-events.xml`. It is keyed by
path alone (`query.include: []`), so a query string can neither bypass nor fragment it,
and an LRU bound of 64 entries caps it at a few megabytes. `X-Astro-Cache: MISS`, `HIT`
or `STALE` names the outcome.

Routes opt in with `PUBLIC_CACHE` from `src/lib/server/public-data.ts`: five minutes
fresh, five more served while one background render replaces it, tag `public`. They opt
in only after complete reads. A failed event read is a 503 with `no-store`; a
testimonial-only failure still renders the home page but does not store it.

Every action that changes events, registrations or testimonials awaits
`purgePublicCache(context)` before it answers, so the next request renders current
data. The lifetime therefore only bounds what changes with the clock (an evening
becoming past, the upcoming list moving at midnight). Direct database edits outside the
actions wait for expiry; a restart empties the cache. The cache is process-local: more
than one replica would need shared invalidation.

The cache wraps the middleware, so a hit is served with the headers stored on its miss
and skips the admin guard, which only concerns `/admin` (never cached). Browsers and
Cloudflare revalidate public HTML; there is no shared-cache lifetime, because the purge
cannot reach them.
