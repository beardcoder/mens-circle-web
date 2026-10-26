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

The browser shares each request across islands, retains loaded data during refresh,
and revalidates on focus/visibility after 30 seconds. There is no interval polling.
Testimonials load near the viewport. Retry is explicit after a failed read. Posting
forms still uses the existing Astro Actions and their field validation, CSRF,
honeypot and per-IP rate limits.
