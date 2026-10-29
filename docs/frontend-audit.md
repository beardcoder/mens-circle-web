# Frontend audit — 28 October 2026

## Findings and implementation

The existing Astro 7.4.2 / Bun setup, strict TypeScript configuration and Astro
image pipeline were already current. The main bottleneck was rendering public
content through client islands on otherwise prerendered pages.

- Home started six event islands and one testimonial island. These now render as
  Astro components using server reads on native route-cache misses. The event overview also ships its
  dates in HTML. Empty schedules and failed reads have distinct states.
- All styles were embedded in every document. `inlineStylesheets: 'auto'` now
  emits larger stylesheets as shared, hashed assets. Only upright fonts preload.
- Text was repeatedly split into word spans for scroll effects. Headings and
  quotes now use continuous text. Content stays visible while scrolling; the
  optional breathing exercise still starts only on request.
- Date rows truncated long locations and fees. Values now wrap. Long testimonials
  use native `details`, and portraits have explicit responsive widths and sizes.
- The mobile menu now reports its expanded state, focuses anchor destinations,
  and closes when desktop navigation takes over. A navigation fallback works
  without JavaScript. The skip link targets a focusable main landmark.
- Removed six obsolete TSX components and `tailwind-animations`. Preact remains
  for interactive registration and the protected admin interface.

The existing palette and identity remain. Playfair headings, sentence-case labels,
consistent spacing and a stable next-date panel establish the revised hierarchy.

## Verification

- `npm run build`: passed.
- `bun run check`: no errors, warnings or hints.
- `bun run lint`, `bun run knip`: passed.
- `bun test`: 75 passed, 0 failed.
- `bun run test:pages`: builds and checks production HTML against a disposable
  SQLite database: empty, scheduled, full, unpublished, partial-failure and
  unavailable states; cache headers; responsive image delivery; sitemap entries.
- Chromium: home, overview, event detail, personal page and privacy page at
  320 / 768 / 1440px, in light and dark modes with reduced motion. No horizontal
  overflow, missing images or browser runtime errors in those checks.
- Home also checked at 390 / 1024px; menu Escape, anchor focus and desktop resize
  checked. Dates, navigation and the registration email fallback checked with
  JavaScript disabled. Desktop and mobile screenshots reviewed.

Uncompressed HTML measured locally: home about 162 KB → 85 KB; overview about
134 KB → 63 KB. Fixtures add published dates and quotes to the new pages; these
are document-size measurements, not field Core Web Vitals or total transfer-size
claims. Both entry pages have zero hydrated islands and no public-data fetches
in the browser.

## Runtime considerations

Update, 29 October: native Astro memory caching now serves home and overview
HTML (120 seconds plus 60 seconds stale-while-revalidate). Application mutations
clear the `home` and `event` cache tags alongside the data cache; failure pages
explicitly disable Astro caching. See `docs/public-api.md` for details.

Home and the overview now require the existing Bun server and database at request
time. Native Astro caches complete route responses: home/overview for 120 seconds
plus 60 seconds stale-while-revalidate, event detail/JSON for 30 seconds, testimonial
JSON for five minutes. There is no separate data-read cache. Actions directly purge
the associated tags; failure pages disable caching.
Already open pages update on navigation. Registration continues refreshing its
capacity and checking availability transactionally when submitted.

There are no database migrations, new external services or changes to API,
authentication, consent, email or retention behavior. Public quotes still contain
only approved author/role/text fields. The interactive registration form still
requires JavaScript and retains its email fallback. This audit does not replace
testing on physical devices or a complete accessibility conformance assessment.

Rendering follows Astro's [component model](https://docs.astro.build/en/basics/astro-components/)
and [client-directive defaults](https://docs.astro.build/en/reference/directives-reference/#client-directives).
