# Public island data

Same-origin GET endpoints, no authentication or cookies required. Responses are JSON.
No participant records, email addresses or precise meeting-address fields are returned.
Approved testimonial author names and roles remain public.
The TypeScript response contract is in `src/components/event/types.ts`.

| Route                       | 200 response                                                                                                               | Freshness  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `/api/public/events`        | `PublicEvents`: status (`scheduled` or `none`), up to 12 upcoming events, next-date summary or null, fee main/note strings | 30 seconds |
| `/api/public/events/{slug}` | `PublicEvent`: id, slug, display view, availableSpots, maxParticipants, isPast                                             | 30 seconds |
| `/api/public/testimonials`  | `{ testimonials: [{ quote, author, role }] }`, up to 200 approved, non-deleted entries in curated order                    | 5 minutes  |

Failures return `{ message: string }`: 404 for an unknown/unpublished event, 503 for
unavailable data. A failed read is never an empty successful list. Errors use
`Cache-Control: no-store`. Successes have ETags; `If-None-Match` may return 304.
Browsers and external shared caches revalidate; Astro's native `memoryCache()`
provider retains successful route responses for the intervals above. Public JSON
routes use `context.cache.set()` directly, tagged `events` or `testimonials`.
Non-200 JSON responses explicitly disable the route cache. The serialization
helper only formats responses/ETags; it does not store data.

Home and `/event` deliver initial HTML using `Astro.cache.set()` directly:
120 seconds plus 60 seconds stale-while-revalidate, tagged `home` and `event`.
Event details use 30 seconds and the `events` tag. `X-Astro-Cache: MISS`, `HIT`
or `STALE` identifies native route caching. There is no separate Map/read cache
and no invalidation wrapper. A cache miss reads the database; a hit reuses the
whole response. Error and partial-failure HTML explicitly disables Astro caching.

Mutation Actions call `context.cache.invalidate()` directly with the tags
`home`, `event`, `events`, `testimonials`. This covers event create/edit/publication/
deletion, testimonial moderation/order/content/deletion, and registration changes.
The purge is awaited before the action completes. Displayed seats remain snapshots;
registration checks availability in its existing database transaction.

The provider is process-local, matching the single Bun deployment. A restart clears
it. Multiple replicas would need shared invalidation; direct database edits outside
Actions rely on route expiry. Pages already open in a browser receive no pushed
updates. Authentication, consent and retention behavior remain unchanged.

A failed event read produces a 503 page with `Cache-Control: no-store` and a reload
link. A testimonial-only failure leaves the home page usable but disables caching.
An empty successful read shows a notification invitation, never an error.

The event registration island still preloads its public event JSON through
`Layout`'s `preloadData`. Its browser resource retains data during refresh and
revalidates on focus/visibility after 30 seconds. There is no interval polling.
Posting forms still uses the existing Astro Actions and their field validation,
CSRF, honeypot and per-IP rate limits. The endpoint contracts are unchanged.
