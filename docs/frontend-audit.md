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

## Update, 30 October: what every page loads

- Tailwind reads classes from `src/` only: words in docs, mail templates, tests and
  server code no longer become utilities (public CSS 62.6 → 60.3 kB raw).
- Playfair is two static 400 faces instead of the variable file: the preloaded serif
  is 21.9 kB instead of 38.4 kB (the italic likewise). Static DM Sans weights were
  measured too (four files, 4 kB less in total) and rejected.
- Astro's prefetch script (two module requests on every page) gave way to one inline
  Speculation Rules block for same-origin links on hover or press.
- The newsletter and testimonial forms load the actions client on first focus.

First load per page, measured locally against the production build (HTML, CSS, JS
gzipped; fonts as served; analytics excluded):

| Page                                | Before               | After                |
| ----------------------------------- | -------------------- | -------------------- |
| `/`                                 | 133.9 kB, 9 requests | 113.8 kB, 7 requests |
| `/event`                            | 129.4 kB, 9 requests | 109.3 kB, 7 requests |
| `/event/<slug>` (before the island) | 129.1 kB, 6 requests | 111.4 kB, 4 requests |
| `/warum-ich-den-maennerkreis-leite` | 125.2 kB, 6 requests | 107.5 kB, 4 requests |
| `/impressum`                        | 122.2 kB, 6 requests | 104.5 kB, 4 requests |

Screenshots of home and an event page at 1440 × 900 are pixel-identical before and
after; forms, field errors and the registration island behave as before.

## Runtime considerations

Update, 30 October: home, overview and event pages share one route-cache policy
(five minutes plus five stale-while-revalidate, tag `public`), purged by every action
that changes public data. The unused list and testimonial JSON endpoints are gone; the
registration island reads only its event's seats, and only when the page returns into
view. The SSR home portrait no longer goes through `/_image`. See
`docs/public-api.md` and `docs/runtime.md`.

Home and the overview require the Bun server and database at request time. There is
no separate data-read cache; failure pages are never stored. Already open pages update
on navigation. Registration checks availability transactionally when submitted.

There are no database migrations, new external services or changes to API,
authentication, consent, email or retention behavior. Public quotes still contain
only approved author/role/text fields. The interactive registration form still
requires JavaScript and retains its email fallback. This audit does not replace
testing on physical devices or a complete accessibility conformance assessment.

Rendering follows Astro's [component model](https://docs.astro.build/en/basics/astro-components/)
and [client-directive defaults](https://docs.astro.build/en/reference/directives-reference/#client-directives).
