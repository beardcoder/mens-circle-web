# CLAUDE.md

Website for the Männerkreis. Astro 7 (Preact TSX islands in the admin only), Tailwind CSS v4, SSR on the Bun
runtime, Drizzle on `bun:sqlite`, email via external listmonk, admin sign-in via Pocket ID.
Code, comments and docs are English; user-facing content is German.
Commit messages are English too, in Conventional Commits form (`fix(seo): …`).

## Commands

```bash
bun run dev            # under an agent it daemonizes; bunx astro dev status|logs|stop
bun run build          # bun --bun astro build: Astro runs on Bun, like the server
bun run check          # astro check
bun run lint           # eslint; complexity ≤ 12, max-depth ≤ 4, blank lines, import order
bun run lint:fix       # sets blank lines and import order, then runs prettier
bun run format         # prettier; also run after db:generate (drizzle/meta is formatted)
bun run format:check   # what CI runs; CLAUDE.md and docs/ are formatted too
bun test               # each *.fixture.ts case runs in its own Bun process
bun run test:pages     # builds, then checks production HTML and headers (disposable DB)
bun run test:browser   # builds, then Chromium: console/CSP errors, axe, forms (fake listmonk)
bun run db:generate    # after editing src/lib/server/db/schema.ts
bun run knip           # unused files, exports and dependencies
bun run brand:export   # after editing theme.css: brand/tokens.json, tokens.css, palette.ase/.gpl
bun run brand:logo     # after editing brand/logo/logo.svg: logo variants, favicons, mail marks
bun run brand:render   # flyers, poster, card, posts, preview images → brand/out (docs/brand)
```

Verify with `check` + `lint` + `format:check` + `test`; CI (`.github/workflows/ci.yml`)
runs those, `build`, the production page checks and the browser check (Playwright +
axe, screenshots as an artifact), plus Lighthouse as an advisory job
(`lighthouserc.json`: performance ≥ 0.95 mobile, CLS 0, warnings only). TypeScript stays on 6.x: `astro check` and typescript-eslint
refuse TS 7. Dependabot auto-merges minor and patch bumps once CI is green, except Astro and
its adapter (their own group, always reviewed by hand). For Astro questions, use the
`astro-docs` MCP server (`.mcp.json`).

## Rules

**Runtime.** One Bun process runs `server.ts`: `Bun.serve()` around the handler of
`@igloczek/astro-bun-adapter` (standalone, autostart off; `dist/server/entry.mjs`): static
files (ETag/304, hashed `/assets/` immutable, the rest `public, max-age=0` added by
`server.ts`), SSR, actions and admin. The adapter is bundled and stays a dev
dependency (as a dependency its `astro` peer bloats the image). The build bundles
everything but `bun:sqlite`. No compression in the app: the Coolify proxy and Cloudflare
do it. `404.astro` is prerendered; unmatched paths get it from disk and never reach the
middleware. `src/middleware.ts` guards `/admin` (a signed session, else the login; sets
`locals.admin`) and applies `lib/cache-policy.ts`. Migrations run on boot.
Layers: `src/lib/server/*` is server-only (pages, actions, endpoints, scripts);
`src/lib/shared/*` holds pure functions and types for everyone (no Node or Bun
imports; dates, HTML escaping, event views, DTOs, admin types); components, layouts
and shared code never import the server lib (ESLint `no-restricted-imports`). Pages
load data and pass it as props. Deployed as one
Docker image on Coolify (Bun pinned to a minor, `oven/bun:1.4-slim`; the entrypoint hands `/data` to `bun` and runs the server as
`bun`, scripts switch via `RUN_AS`;
port 8090, SQLite on the `/data` volume; `/health` answers 503 when SQLite does not); env vars are in
`.env.example` and the README. Retired URLs redirect in `astro.config.mjs`
(`redirects`); `trailingSlash: 'never'`.

**Tests.** Nothing opens or reads on import: `loadConfig(env)` is pure, and the
database opens on first use (`getDb()`; `db` forwards to it). In-process tests pass
their own env to `loadConfig` or assign `config` fields, and install a database with
`useDatabase(openDatabase(':memory:', { migrationsFolder }))` (see
`tests/public-data.test.ts`). The older `*.fixture.ts` suites still spawn a process
with `--no-env-file` (module state such as listmonk's in-flight map, query counting)
and move in-process one at a time.

**Actions.** Everything is an Astro Action (`src/actions/*`), merged flat in `index.ts`.
Public forms validate only in their action Zod schemas. `lib/form.ts` owns submit,
field errors and the result line of every public form (`FormStatus`); it loads the
actions client on the first focus in the form, not with the page. The registration
(`components/event/EventRegister.astro`) is a server-rendered form posting to
`actions.register`: without JS the event page answers the POST itself (`private,
no-store`, never from or into the route cache; errors keep the inputs). Newsletter
and testimonial need JS. Feedback stays at the form rather than a toast. Public forms
go through `publicForm()` in `actions/forms.ts`: an in-process per-IP rate limit
(`lib/server/ratelimit.ts`, one more reason for a single replica; the IP comes from
`CF-Connecting-IP` with `TRUSTED_PROXY=cloudflare`, else the peer address, never from
`X-Forwarded-For`), a honeypot field
(`website`) answered with a fake success, German messages, and no internal error
ever shown. Admin pages mount Preact workspaces with local state and native navigation.
`components/admin/useAdminTask.ts` handles busy state and inline feedback. All private
admin reads and mutations call `requireAdmin`; see `docs/admin-ui.md`.
Other endpoints: `/anmeldung/absagen` (the signed cancel link from the participant
mails, `lib/server/cancel-token.ts`; GET shows, POST cancels; private, noindex), `/health`, `/sitemap-events.xml`, `/auth/*`, `/api/public/events/<slug>`
(live seats), `/api/public/events/<slug>/ics` (served inline from a URL: iOS cannot open a `data:` calendar link; fields in `lib/shared/ics.ts`), `/fonts/mail/*` (CORS for listmonk).

**Auth.** Pocket ID via `openid-client` (`lib/server/oidc.ts`): code flow with PKCE +
state, `client_secret_post` (Basic would form-encode the UUID client id). The callback
URL comes from `APP_URL`, not the request (proxy reads `http://`). Admission:
`OIDC_ADMIN_GROUP` or a verified `ADMIN_EMAIL`; the session records which, and every
read re-checks it against the current configuration. `ADMIN_SESSION_SECRET` has no fallback
and needs ≥ 32 chars, otherwise no session is signed or trusted. Never add a default.

**CSRF.** `security.allowedDomains` (from `PUBLIC_SITE_URL`) lets Astro trust the
proxy's forwarded headers. Never fix a 403 with `checkOrigin: false`.

**CSP.** Astro's `security.csp` hashes every script it renders (a header on SSR
pages, a `<meta>` on prerendered ones); `server.ts` adds a second policy
(`frame-ancestors 'none'`, `object-src`, `base-uri`; a complete host-free one on
`/admin` and `/auth`) plus `nosniff`, `Referrer-Policy` and `Permissions-Policy`. An
`is:inline` script must come from `src/scripts/inline.ts`, whose strings
`astro.config.mjs` hashes: a hash added from a component arrives after the SSR headers.
A new third-party host goes into the config's directives. Styles keep
`'unsafe-inline'` (the BayernAtlas component renders `<style>` into its shadow root).
JSON-LD escapes `<`. `test:pages` checks the hashes; HSTS is set at the proxy.

**Data.** A read-then-write under concurrency goes in a synchronous
`db.transaction(fn, { behavior: 'immediate' })` with no `await` inside (see
`claimSeat()`). Capacity is computed from `holdsASeat()` only. Every change to
registrations or `max_participants` ends in `reconcileSeats(eventId)`, which promotes
waiters into free seats (never for past events) and mails them after the commit;
taking a seat by hand over capacity needs `overbook`. More than one web
replica on the same SQLite file is not supported.

**Rendering.** Home, `/event` and the event pages are SSR with no content hydration:
dates, seats and approved testimonials are in the HTML. They sit in Astro's route cache
(`memoryCache` in `astro.config.mjs`: keyed by path, query ignored, at most 64 entries).
A page calls `Astro.cache.set(PUBLIC_CACHE)` (`lib/server/public-data.ts`: 5 min + 5 min
stale-while-revalidate, tag `public`) only after complete reads; every action that
changes events, registrations or testimonials awaits `purgePublicCache(context)`, so
the lifetime only bounds what changes with the clock. A failed read is a 503 with
`no-store`; a testimonial-only failure renders the page without storing it. An empty
schedule shows the "in Planung" card, never the error. No public page hydrates
an island (Preact is the admin's only); the registration shows the rendered seat
snapshot. Public DTOs exclude precise addresses and participant data; see
`docs/public-api.md`. The registration action checks capacity transactionally; cached
counts do not reserve seats. Legal pages, personal page and testimonial form stay
prerendered.

**Caching.** `lib/cache-policy.ts` is the default for rendered responses (middleware):
admin, `/auth`, actions and server islands `private, no-store`; everything else
`public, max-age=0, must-revalidate` unless the route sets its own. The route cache wraps
the middleware: a hit is served with the headers stored on its miss. `server.ts` keeps
such a hit as bytes for one second per path (emptied by every non-GET request) and
answers it before the adapter. Static files keep
the adapter's headers. No `s-maxage`: the purge cannot reach Cloudflare. Public API
errors are `no-store`. `public/sw.js` only retires the old breathing app's service
worker, is revalidated on every load and goes after 2027-04-26 (docs/runtime.md).

**Generated files.** `sitemap()` lists `/sitemap-events.xml` in the index (`customSitemaps`).
`src/pages/llms.txt.ts` prerenders a short index of the three public content pages.
No live-site fetching, Markdown export or post-build patching is needed. The brand
files are generated and committed (docs/brand/README.md): `brand/tokens.*` and
`brand/palette.*` from `theme.css` (`brand:export`), every logo, favicon and mail
mark from `brand/logo/logo.svg` (`brand:logo`), the preview images
`public/images/og-*.png` from their templates (`brand:render --install`, then bump
their `?v=`). Never hand-edit them; `tests/brand-export.test.ts` and
`tests/brand-logo.test.ts` fail on drift. `brand/out/` and `brand/.dist/` are not
committed. The template pages (`src/pages/brand/[template].astro`) exist only in a
brand build (`BRAND_TEMPLATES=1`); a normal build has no `/brand/*`.

**Images.** On prerendered pages, Astro's `<Image />` straight from `astro:assets`, no
wrapper component: `layout="constrained"` with `width`/`height` (Astro writes `srcset`
and `sizes`), `position` for the crop, Tailwind for the box (`image.responsiveStyles`
stays off). Photos live in `src/assets/images/`. SSR pages never use `<Image />`: it
would run sharp per request through `/_image`, which the middleware answers with 404 in
production. The home page uses pre-sized files beside the original with a written
`srcset`: the photo in its ring (`markus-kreis-{480,720,960}.avif`, square, AVIF q52)
and Markus's avatar (`markus-avatar-192.webp`); regenerate them when the photo
changes. Sharp is a build-time dev
dependency. All events use `/images/og-default.png`, rendered from its template.

**Cron.** Host-driven: Coolify runs `bun run scripts/schedule.ts` every minute. It
decides what is due first and imports a task's module only then (`dueTasks()`):
importing the server lib opens the database and migrates. The
reminder pass runs every 15 min, the S3 backup at 03:00 UTC when `BACKUP_S3_*` is set.
Reminders go out in Berlin wall-clock time (`lib/server/reminder-window.ts`): 18:00–22:00
the evening before ("morgen"), else from 10:00 on the day until the start ("heute"),
once per registration (`reminder_sent_at`). Time: `event_date` is a Berlin calendar day (`"2026-11-12"`), `start_time`/`end_time`
are `HH:MM`; every label, comparison, `.ics` and JSON-LD time comes from
`lib/shared/time.ts` (`formatDateLong`, `formatTimeRange` with one spelling,
`zonedTime`, `isPast`, `todayBerlin`). Never `getUTC*` on an event date. At 02:30 UTC `lib/server/retention.ts` anonymises
participants `RETENTION_DAYS` after their last event (≤ `DEFAULT_RETENTION_DAYS`, the
number `/datenschutz` prints), deletes expired event lists in listmonk and clears
published testimonials' addresses; change the period in `lib/shared/retention.ts`
and the policy together. Logs never carry an address (`logId()` in `listmonk.ts`).
No in-process timer and no `Bun.cron` (throws at
boot). Beside `dist/` and `drizzle/`, the Docker image keeps only the three scheduled
scripts, `src/lib/server/`, `src/lib/shared/` (pure helpers), `src/data/` (site config), the mail fonts (`src/assets/mail`) and the production
`dependencies` (the build bundles the rest): what those scripts and the server lib
import at runtime must be in there (other `src` files as types only).

**Email.** listmonk is external; this repo only integrates it. `lib/server/email.ts` is
the payload contract. Keep list/template IDs (incl. `events.listmonk_list_id`) stable.
`confirmation_sent_at` is set only when listmonk accepted the mail. Participant
mails carry `cancelUrl` (empty without `ADMIN_SESSION_SECRET`; the templates then
fall back to "write to us"). A public sign-up never overwrites a stored participant's
name or phone (the address is unverified): it fills empty fields and keeps what
differs on the registration (`submitted_*`) for the admin.
`listmonk-templates/` holds the versioned copies of the listmonk templates: edit
there, then paste into listmonk. The newsletter body is built in
`lib/server/mail/newsletter.ts`; mail colours come from `lib/shared/brand.ts`, which
`tests/brand.test.ts` holds equal to the `--p-*` primitives and to every hex in the
templates. The brand name comes from `src/data/site.json` only. The `template-contract` email test fails when a
template reads a `.Tx.Data` field its payload does not send. The templates load the
mail mark from `/images/logo-mail.png` by URL; mails already sent still load
`/images/logo-flame.png`, so keep both files.

**Map.** The BayernAtlas web component (`<bayern-atlas>`, `atlas.bayern.de/wc.js`,
an iframe; keyless). Its script loads only near the viewport, as a classic script:
`type="module"` needs CORS, which atlas.bayern.de grants only to localhost and a few
origins, so it worked locally and failed live; it reads its attributes
once, on connect, and takes commands (`addMarker`) only after `baLoad`. `c` is lon,lat.
Keep the attribution line under the map.

**Styling.** Tailwind v4 (`@tailwindcss/vite`), CSS-first. `styles/theme.css` holds the
tokens, variants, surfaces, the bleed utilities and keyframes; `global.css` (public,
one shared hashed file), `admin.css` and `print.css` (brand templates) are the three
entries. The first two read classes from `src/` only (`source('..')`, so words in
docs, mail templates and tests never become utilities) and skip server-only code;
`global.css` keeps the admin and print sources out with `@source not`, `admin.css`
the print and styleguide sources; `print.css` reads only the print, brand and ui
components. Printing a page of the site (`@media print`) lives in `global.css`.
What lies below the first screen arrives once (`Reveal.astro`); the two scroll-linked bars use CSS view timelines (`animation-timeline`); the FAQ is
native `<details>`; no animation library ships to the browser. The opening, page transitions, loops and
state transitions are the theme's own keyframes and `--animate-*` tokens (`rise`,
`skeleton`); there is no animation plugin.
No `<style>` blocks and no component stylesheets: utilities in the
markup, recipes in `lib/ui.ts`, components in `components/ui/`. `docs/design-system.md`
is the reference. Class strings are complete and static; never add a class that sets a
property the component already sets (add a prop). Scripts hook onto `data-*`
attributes, never onto styling classes; states are `data-*` too (`data-open`,
`data-state`, `data-tone`).

## Design

- `docs/design-system.md` is the reference, `/styleguide` the living one (read from
  `theme.css` by `lib/brand/theme-tokens.ts`, real components; noindex, in the
  browser check). The idea: the circle of chairs. A centre, things turned towards
  each other, much air; poster-sized type where the site invites, calm reading where
  it explains. The look starts from the dark-botanical theme (ConardLi/garden-skills)
  and is earthier and warmer than it: at night a brown-black like dark soil with
  soft pools of light, warm bone text, a clay terracotta and Cormorant with its
  italic; by day the same family turned round (bone
  paper, near-black text). One accent, a clay terracotta (mark, the one action, links, the italic phrase; its deep tone on paper). Open and
  full-bleed: grounds from edge to edge, content between lines, no rounded card.
  The circle is the one motif, in four
  forms: the mark, the seat ring, the stamp, the index number. Same function, same
  component.
- Stance and voice (design-system.md): the page acts like a circle leader who holds
  the space instead of performing. Quiet, the frame visible (course, five
  agreements, consent, no therapy), grounded, open to every man. Copy: "du", plain
  German, no jargon, no "brother" tone, no promises of healing; no dashes for effect,
  slogan contrasts, triads or therapy phrases; each point once per page.
- Colours are roles (`ground`, `ground-alt`, `raised`, `fg`, `fg-soft`, `fg-muted`,
  `line`, `line-strong`, `line-bold`, `accent`, `accent-soft`,
  `fill`/`fill-strong`/`on-fill`, `spark`, `success`/`danger` for states only); hex
  primitives (`--p-*`) live on `:root` only, mirrored in `lib/shared/brand.ts`
  (`tests/brand.test.ts`), never in markup. Day and night follow the system
  (`light-dark()`); `ModeToggle` pins Auto · Hell · Dunkel as `data-mode`
  (`mc-appearance`). Every text pair ≥ 4.5:1 on every ground in both modes, control
  lines ≥ 3:1 (`tests/contrast.test.ts`); `line` never outlines a control alone; the
  spark is never text on paper or sand. Check new pairs in both modes.
- Grounds: `Section ground` is `default` (paper), `alt` (sand: facts, course,
  dates) or `dark`
  (`surface-dark`, the theme's near-black with its three wandering pools of light, its
  primitive still called `--p-forest`: opening, agreements, voices, registration,
  menu, last band, footer). The site has these three grounds; `moss` stays for print. Grounds
  run from edge to edge; `Section` clips horizontally what bleeds.
- Type: Cormorant variable, upright and italic (`font-display`, two files in
  `src/assets/fonts/`, local provider, from weight 500, figures lining via `lnum`;
  both faces `font-display: optional` with every file preloaded, never `swap` or
  `block`: a font arriving after the first paint re-lays the page out and flickers)
  for titles, dates, numbers, poster words; a light, narrow face, so its sizes run
  a step larger; IBM Plex Sans (`font-sans`, static regular and semibold) for text,
  navigation, forms, data. Role tokens
  `text-poster`, `text-hero`, `text-index`, `text-page`, `text-section`, `text-sub`,
  `text-quote`, `text-md` (body), `text-base` (controls), `text-marginal`. `<em>` in
  a title is Cormorant's italic in the accent (the clay terracotta on the dark ground). Labels in sentence
  case. Running text on `max-w-measure`. A dash in running copy is bound to the word
  before it (`\u00a0–`).
- The four moves, the only ways to break the 12-column grid, each at most once per
  section: the margin column (`margin` recipes in `lib/ui.ts`: side 1–3, content
  4–12, reading 4–10, a crossing title 1–10), the overlap (`overlap` token, always on
  a ground of its own, towards the centre), the bleed (`bleed-l`/`-r`/`-x`, the side
  changes down the page) and the poster word (`Poster`, one per screen). Never:
  staircases, rotation, shadows, boxes around content, text
  over a photograph.
- Shapes: open and square. Grounds, bands, the registration and the map have no
  radius. `rounded-full` for what you press and for circles (people's photographs,
  seat ring, stamp, avatar); fields `rounded-md` (8px) with the buttons' heights;
  only what floats (a dialog) and the admin's cards take `rounded-xl`. No rounded
  cards on public pages: facts, steps, agreements, FAQ and voices are rows between
  lines. `shadow-overlay` only for what floats. Images: a person in a circle, a place
  in a rectangle cut by the edge; one form per section.
- Skills are vendored in `.claude/skills/` (sources in `skills-lock.json`):
  `web-design-engineer` and the three animation skills named under Motion.
- Against the generated look (the `web-design-engineer` skill's failure patterns,
  `skills-lock.json`): no label above every heading (`Eyebrow` only where it adds the
  place or the kind of page), no decorative numbers (an index number only where
  there is a real order: the course, the agreements), no drawn shape standing in for
  a picture (no empty rings; the pools of light belong to the dark ground and are
  its one decoration), one label for one action, nothing invented.
- Shared components: `EventSummary` (every date: date, facts, `SeatRing`, action;
  fed by `lib/shared/event-status.ts`), `SeatRing` (`lib/shared/seats.ts`:
  `seatFill`, `seatDots`), `Stamp`, `Lockup`, `Qr` (`src/components/brand/`, shared
  with the print templates), `PageIntro`, `SectionHead`, `Poster`, `Index`,
  `Marginal`, `Eyebrow`, `Fact`, `Button`, `Field` + `FormStatus`,
  `TestimonialList`, `Accordion`. Use them; do not restyle a copy.
- Home: the forest opening (statement at poster size, the one action, the next
  date; the photograph cut by the right edge, the seat ring overlapping it; the bar's
  action outlined over it), facts, intro (questions in the margin), course (sand,
  index numbers), agreements (forest), taking part (`#termine`, "Dabei sein." as a
  poster word), Markus (one sentence of his under a rule), voices (forest, every
  voice in full), FAQ, staying in touch (forest, the stamp), the footer.
- Header 72px: links from `nav`, one action; over the home opening clear with light
  text until the page moves (`data-scrolled`), then 95 % paper; fixed bars blur only
  from `lg` on a hovering pointer. The phone menu is a native modal `<dialog>` on
  the forest, opening as a circle.
- Motion (design-system.md, "Motion"): calm, and every piece has a reason. What
  moves: the change of page, a fade and nothing else (cross-document view
  transitions, `@view-transition`; the opening of the page that arrives does not
  rise or settle, it is there with the first paint and is the LCP; only the seat
  ring's taken chairs fill in); the pools of light on every dark ground, wandering
  plainly but slowly (`pool-wander-a` / `-b` on `surface-dark::before` and
  `::after`, two composited layers on paths of their own); what lies
  below the first screen, every piece of it, sliding up and fading in once as it is
  first scrolled to (`Reveal.astro` takes titles, paragraphs, rows, figures, forms
  and lone links from the markup, plus `data-reveal` / `data-reveal-group`, and
  marks them `data-arrive`: 40px up, 900ms, the fade 700ms on `--ease-fade`, pieces
  that come together 80ms apart, starting a fifth of the window above its lower
  edge so it is seen on a phone and clear of the bottom bar; never for what is on
  screen at load); the opening's photograph
  coming a little closer as the opening leaves; the stamp's ring of words turning
  once in two minutes; the mark turning a quarter when the logo is hovered; what
  answers the hand (buttons press to 0.97 in 150ms, links, the native `<details>`
  of the FAQ unfolding and fading, the phone menu, the calendar popover growing
  from 0.97); what answers a form (its result and a field's message arrive 4px up
  via `@starting-style`; after a registration the next free chair of the seat ring
  is taken, `form:success`); the change of colour mode (a same-document view
  transition); and two bars whose place depends on the scroll (the event page's
  dock, the phone `ActionBar`: view timelines lifted by `timeline-scope` on `body`,
  an observer and a CSS transition where those are missing). Build motion with the
  vendored skills (`animate`, `animation-performance`,
  `find-animation-opportunities`, refined for Astro and vanilla CSS/JS): transforms
  and opacity only, CSS first, then WAAPI, no animation library, UI under 300ms,
  the theme's own curves. Never add: a rise or slide on arriving at a page, anything
  that re-animates each time it is scrolled past, pinning or scroll-jacking,
  anything that follows the pointer, anything that starts invisible on the first
  screen. Under reduced motion
  everything rests.
- Lighthouse on every motion change (design-system.md): CLS 0, no forced reflow,
  only opacity and transforms move.
  Never set a state attribute on `<html>` while the page moves; never read layout
  or `scrollY` at load (use an `IntersectionObserver`); nothing that holds the LCP
  waits for a script. No `content-visibility`.
- No layout shift: summary lines are one line (`truncate`); a title's measure is in
  `em`, never `ch`.
- Page transitions are a native cross-document cross-fade (`@view-transition`,
  `plus-lighter`, one duration, linear). No `:has()` on `body` or `html`.
- Styles live in the component's markup as utilities. `global.css` is one stylesheet
  for every public page, so keep one-off arbitrary values few; the print templates
  size everything in `cqw` of their sheet and may use arbitrary values freely.
- A token the styleguide describes carries a trailing comment in `theme.css`; German
  notes live in `lib/brand/notes.ts`.

## Conventions

- Content and section order live directly in `src/pages/*.astro`; legal pages are
  explicit `impressum.astro` and `datenschutz.astro` routes. No content collections
  or JSON page content. Section components live in `src/components/blocks/`; pages
  pass their content explicitly as props and rich-text slots. Load dynamic data in
  server code or through the public JSON endpoints; blocks only render their inputs. Component-specific
  browser behavior belongs in its own `<script>` (Header, ModeToggle,
  BackToTop, ActionBar, EventDock, Reveal), with no global client entry. Public form helpers stay
  in `lib/form.ts`; admin helpers live beside their Preact components. `Prose` accepts inline markup in its slot or
  an `html` prop for dynamic content. Static FAQ answers, journey steps and facts
  use slotted item components at their page location, rather than frontmatter arrays.
  FAQ and journey microdata describe the visible HTML directly, including dynamic
  event answers. `src/data/*.json` is shared site config.
- The brand name comes from `site.siteName`; never type it out.
- Canonical URLs come from `lib/canonical.ts`.
- Prefetch is one Speculation Rules block in `Layout.astro`: same-origin links on hover
  or press (Chromium), never `/admin`, `/auth` or `/api`. No Astro prefetch script and
  no per-link attributes.
- Search: every public page is indexed and in the sitemap, the legal pages and
  `/teile-deine-erfahrung` included; only `/admin`, `/auth/*` (redirect endpoints),
  `/styleguide` (`noindex, follow`) and the 404 stay out (`noindex` on the admin and
  the 404). llms.txt lists the
  three content pages. An event held outside Straubing names its
  place in the `<title>` (≤ 60 chars, brand dropped first). Structured data states only
  what the pages say (Person, `areaServed`); no FAQPage for rich results.
- JSON-LD ids (`#organization`, `#markus`, `#website`, `#series`) are defined once.
- Aliases: `@lib/*`, `@components/*`, `@data/*`.
- Layout ESLint enforces (`eslint.config.ts`; Prettier leaves it alone): a blank line
  after declarations (one-line ones may stand together), around `if`, loops,
  `switch` and `try`, and before `return`. Imports are sorted in groups: side
  effects, `node:`/`bun:`, `astro:` and packages, aliases, relative.
