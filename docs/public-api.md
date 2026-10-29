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
Browsers revalidate; shared caches may retain successful data for the stated interval.

The Bun process caches and coalesces reads, with at most 128 entries.
Durations apply per cache layer and can add up; a visible tab is not continuously
refreshed. These are display snapshots, not real-time seat reservations. Successful
admin edits and registrations clear this cache. CDN copies may remain for up to
30 seconds (testimonials: 5 minutes). Registration always checks capacity in its
existing database transaction; a displayed seat count never guarantees a seat.

Home and `/event` render cached public data on the server. Dates and approved
quotes are present in the initial HTML, with no hydration or browser JSON reads.
Their browser HTML revalidates on navigation; the process read cache still applies.
The native Astro `memoryCache()` provider also stores full home and event-overview
HTML for 120 seconds with 60 seconds stale-while-revalidate, tagged `home` and
`event`. `X-Astro-Cache: MISS`, `HIT` or `STALE` identifies its state. Application
mutations await invalidation of both tags through their Astro Action context:
event save/publication/deletion, testimonial publication/order/content/deletion,
new registrations and registration status/deletion. The same function clears the
public-data read cache first. Unavailable and partial-failure pages explicitly
disable `Astro.cache`, in addition to sending `no-store`.

This cache is process-local, matching the single Bun server deployment. A restart
clears it; multiple replicas would require shared invalidation. Direct database
changes outside application actions rely on cache expiry. Durations across HTML
and data layers can add up. Invalidation affects subsequent requests; documents
already open in a browser are not pushed updates.
A failed event read produces a 503 page with `Cache-Control: no-store` and a reload
link. A testimonial-only failure leaves the home page usable but disables caching.
An empty successful read shows a notification invitation, never an error.

The event registration island still preloads its public event JSON through
`Layout`'s `preloadData`. Its browser resource retains data during refresh and
revalidates on focus/visibility after 30 seconds. There is no interval polling.
Posting forms still uses the existing Astro Actions and their field validation,
CSRF, honeypot and per-IP rate limits. The endpoint contracts are unchanged.
