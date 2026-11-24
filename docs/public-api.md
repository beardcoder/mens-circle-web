# Public data and route cache

## Live seats

One same-origin GET endpoint, no authentication or cookies. No page loads it: the
event page renders its seats and registration form on the server. It stays for
integrations (and beside its `.ics` neighbour). No participant records, email addresses or precise meeting-address
fields are returned. The TypeScript contract is `PublicEvent` in
`src/components/event/types.ts`.

| Route                       | 200 response                                                                   |
| --------------------------- | ------------------------------------------------------------------------------ |
| `/api/public/events/{slug}` | `PublicEvent`: id, slug, display view, availableSpots, maxParticipants, isPast |

Failures return `{ message: string }` with `Cache-Control: no-store`: 404 for an
unknown or unpublished event, 503 when the database cannot be read. A failed read is
never stored. Successes are `public, max-age=0, must-revalidate`.

The registration form shows the snapshot the page was rendered with. The plugin's
`register` route counts the seats again before it stores the registration; a displayed
count never reserves a seat. Posted without JavaScript, the form gets its answer from the event
page itself, marked `private, no-store` and kept out of the route cache.

`/api/public/events/{slug}/ics` is the calendar file, linked from the event page's
"Apple Kalender, Outlook" button and from the confirmation mails. It is served
`inline` as `text/calendar` from this real URL, because iOS Safari hands such a
response to the Calendar app but cannot open a `data:` link or honour `download`.
`lib/shared/ics.ts` fills what Apple Calendar shows: title, notes (description, how to
find the room, fee, page, contact), the full address, `GEO` and Apple's map pin
(`X-APPLE-STRUCTURED-LOCATION`, travel-time alerts), the page as `URL`, status,
colour, two alarms (the evening before and an hour before) and `LAST-MODIFIED`, so a
newer download replaces the older entry. Lines fold at 75 octets.

## Route cache

Astro's `memoryCache()` holds complete responses in the one server process: home,
`/event`, every event page, the endpoint above and `/sitemap-events.xml`. It is keyed by
path alone (`query.include: []`), so a query string can neither bypass nor fragment it,
and an LRU bound of 64 entries caps it at a few megabytes. `X-Astro-Cache: MISS`, `HIT`
or `STALE` names the outcome.

Routes opt in with `PUBLIC_CACHE` from `src/lib/server/public-data.ts`: five minutes
fresh, five more served while one background render replaces it, tagged with the
collection names (`events`, `registrations`, `testimonials`). They opt
in only after complete reads. A failed event read is a 503 with `no-store`; a
testimonial-only failure still renders the home page but does not store it.

EmDash purges those tags itself whenever an entry is published, changed, unpublished or
trashed in the admin; the sign-up and the cancel page await `purgePublicCache(context)`
before they answer. The next request therefore renders current data, and the lifetime
only bounds what changes with the clock (an evening becoming past, the upcoming list
moving at midnight). Writes outside both (`emdash seed`, the plugin's cron) wait for
expiry; a restart empties the cache. The cache is process-local: more
than one replica would need shared invalidation.

The cache wraps the middleware, so a hit is served with the headers stored on its miss
(EmDash keeps pages rendered for a signed-in editor out of it). Browsers and
Cloudflare revalidate public HTML; there is no shared-cache lifetime, because the purge
cannot reach them.
