# CLAUDE.md

Website for the Männerkreis. Astro 7, Tailwind CSS v4, SSR on the Bun runtime, EmDash as the
CMS (collections on SQLite, its admin with passkeys, one native plugin), the newsletter in
an external listmonk.
Code, comments and docs are English; user-facing content is German.
Commit messages are English too, in Conventional Commits form (`fix(seo): …`).

## Commands

```bash
bun run dev            # under an agent it daemonizes; bunx astro dev status|logs|stop
bun run build          # bun --bun astro build: Astro runs on Bun, like the server
bun run check          # astro check
bun run lint           # eslint; complexity ≤ 12, max-depth ≤ 4, blank lines, import order
bun run lint:fix       # sets blank lines and import order, then runs prettier
bun run format         # prettier
bun run format:check   # what CI runs; CLAUDE.md and docs/ are formatted too
bun test               # each *.fixture.ts case runs in its own Bun process
bun run test:pages     # builds, then checks production HTML and headers (disposable EmDash site)
bun run test:browser   # builds, then Chromium: console/CSP errors, axe, forms (fake listmonk)
bun run knip           # unused files, exports and dependencies
bun run brand:export   # after editing theme.css: brand/tokens.json, tokens.css, palette.ase/.gpl
bun run brand:logo     # after editing brand/logo/logo.svg: logo variants, favicons, mail marks
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
`server.ts`), SSR, actions and EmDash (admin and API under `/_emdash`). The adapter is
bundled and stays a dev dependency (as a dependency its `astro` peer bloats the image).
The build bundles everything. No compression in the app: the Coolify proxy and Cloudflare
do it. `404.astro` is prerendered; unmatched paths get it from disk and never reach the
middleware. `src/middleware.ts` checks the origin of every write outside `/_emdash` and
applies `lib/cache-policy.ts`.
Layers: `src/lib/server/*` is server-only (pages, actions, endpoints, the plugin);
`src/lib/shared/*` holds pure functions and types for everyone (no Node or Bun
imports; dates, HTML escaping, event views, DTOs, the entry → event mapping); components,
layouts and shared code never import the server lib (ESLint `no-restricted-imports`).
Pages load data and pass it as props. Deployed as one Docker image on Coolify (Bun pinned
to a minor, `oven/bun:1.4-slim`; the entrypoint hands `/data` to `bun` and runs the server
as `bun`; port 8090, SQLite on the `/data` volume; `/health` answers 503 when the CMS
database does not); env vars are in `.env.example` and the README. Retired URLs redirect in
`astro.config.mjs` (`redirects`, `/admin` → `/_emdash/admin`); `trailingSlash: 'never'`.

**CMS.** EmDash (`emdash`, an Astro integration in `astro.config.mjs`) owns the content
and the back office. Collections are defined in `seed/seed.json` (applied on first start;
`events` with drafts and revisions, `registrations`, `testimonials` with drafts); change
the model there and in the admin together. The database is `DATABASE_PATH`
(`./data/emdash.db`), baked into the build; admin sessions are Astro sessions in files
beside it. Pages read with `getEmDashCollection`/`getEmDashEntry`
(`lib/server/content.ts`), mapped to the site's event shape by `lib/shared/event-entry.ts`
(datetimes → Berlin day and `HH:MM`, Portable Text → plain text for meta, mails and
`.ics`). Use EmDash's own features (drafts, publish, trash, roles, the email pipeline)
before building around them. What collections cannot do lives in the one native plugin,
`src/plugin/index.ts`: public routes `register`, `testimonial`, `cancel`, and the cron
tasks; its logic is in `lib/server/registration.ts` and `registration-tasks.ts`, written
against `Store` (the slice of the plugin context it uses) so tests pass a fake. The
plugin API writes no reference links, so `registrations.event` is a reference field
without a relation (a text column holding the event id, filterable). The old database
moves over once with `scripts/migrate-to-emdash.ts` (README).

**Tests.** Nothing opens or reads on import: `loadConfig(env)` is pure. In-process tests
pass their own env to `loadConfig` or assign `config` fields. The plugin logic is tested
against a fake `Store` (`tests/registration.test.ts`). `test:pages` and `test:browser`
run the built server in a disposable EmDash site (`scripts/emdash-sandbox.ts`: the seed
plus test content through the `emdash seed` CLI, the server started in that directory).
EmDash reads a missing table as empty; to simulate a failed read, break the table
(`breakTable`).

**Actions.** The public forms are Astro Actions (`src/actions/forms.ts`, merged in
`index.ts`). They validate only in their Zod schemas, then call the plugin's public
routes through `lib/server/plugin-route.ts` (`locals.emdash.handlePublicPluginApiRoute`:
EmDash gives anonymous requests no other way to write). A refusal the plugin words for
the visitor (`NOT_FOUND`, `CONFLICT`) becomes the form's message; anything else is
"Es ist ein Fehler aufgetreten". `lib/form.ts` owns submit, field errors and the result
line of every public form (`FormStatus`); it loads the actions client on the first focus
in the form, not with the page. The registration (`components/event/EventRegister.astro`)
is a server-rendered form posting to `actions.register`: without JS the event page
answers the POST itself (`private, no-store`, never from or into the route cache; errors
keep the inputs). A full evening shows no form (no waiting list). Newsletter and
testimonial need JS. Feedback stays at the form rather than a toast. Public forms go
through `publicForm()` in `actions/forms.ts`: an in-process per-IP rate limit
(`lib/server/ratelimit.ts`, one more reason for a single replica; the IP comes from
`CF-Connecting-IP` with `TRUSTED_PROXY=cloudflare`, else the peer address, never from
`X-Forwarded-For`), a honeypot field (`website`) answered with a fake success, German
messages, and no internal error ever shown. Other endpoints: `/anmeldung/absagen` (the
signed cancel link from the participant mails, `lib/server/cancel-token.ts`; GET shows,
POST cancels through the plugin; private, noindex), `/health`, `/sitemap-events.xml`,
`/api/public/events/<slug>` (live seats), `/api/public/events/<slug>/ics` (served inline
from a URL: iOS cannot open a `data:` calendar link; fields in `lib/shared/ics.ts`),
`/fonts/mail/*` (CORS for listmonk).

**Auth.** EmDash's own: passkeys, invites and roles under `/_emdash/admin`; the first admin
is created in its setup wizard. The site has no sign-in of its own. `CANCEL_LINK_SECRET`
(≥ 32 chars) signs the cancel links and has no fallback; never add a default.

**CSRF.** EmDash turns Astro's `checkOrigin` off for the whole site and guards only its own
routes. `src/middleware.ts` therefore refuses every write outside `/_emdash` whose
`Origin` is neither the public origin nor the requested host. Never remove that check.
`security.allowedDomains` (from `PUBLIC_SITE_URL`) lets Astro trust the proxy's
forwarded headers.

**CSP.** Astro's `security.csp` hashes every script it renders (a header on SSR
pages, a `<meta>` on prerendered ones); `server.ts` adds a second policy
(`frame-ancestors 'none'`, `object-src`, `base-uri`) plus `nosniff`, `Referrer-Policy` and
`Permissions-Policy`. EmDash sends its own complete policy for `/_emdash`. An
`is:inline` script must come from `src/scripts/inline.ts`, whose strings
`astro.config.mjs` hashes: a hash added from a component arrives after the SSR headers.
A new third-party host goes into the config's directives. Styles keep
`'unsafe-inline'` (the BayernAtlas component renders `<style>` into its shadow root).
JSON-LD escapes `<`. `test:pages` checks the hashes; HSTS is set at the proxy.

**Data.** A seat holds while its registration has no `cancelled_at`
(`holdsASeat()` in `lib/shared/event-entry.ts`); seats are counted from the
registrations of the event. A sign-up is created and then published, so the public pages
(which read published entries) count it. Full is full: no waiting list. The seat check
and the insert are two steps (`shortcut:` in `registration.ts`). Cancelling sets
`cancelled_at`; the admin can also trash a registration. More than one web replica on
the same SQLite file is not supported.

**Rendering.** Home, `/event` and the event pages are SSR with no content hydration:
dates, seats and approved testimonials are in the HTML. They sit in Astro's route cache
(`memoryCache` in `astro.config.mjs`: keyed by path, query ignored, at most 64 entries).
A page calls `Astro.cache.set(PUBLIC_CACHE)` (`lib/server/public-data.ts`: 5 min + 5 min
stale-while-revalidate, tagged with the collection names, which EmDash purges on every
publish, edit and trash in the admin) only after complete reads; the sign-up and the
cancel page await `purgePublicCache(context)`, so the lifetime only bounds what changes
with the clock. A failed read is a 503 with
`no-store`; a testimonial-only failure renders the page without storing it. An empty
schedule shows the "in Planung" card, never the error. No public page hydrates
an island; the registration shows the rendered seat snapshot. Public DTOs exclude precise addresses and participant data; see
`docs/public-api.md`. The plugin counts the seats again on every sign-up; cached counts
do not reserve seats. Legal pages, personal page and testimonial form stay
prerendered.

**Caching.** `lib/cache-policy.ts` is the default for rendered responses (middleware):
`/_emdash`, `/anmeldung`, actions and server islands `private, no-store`; everything else
`public, max-age=0, must-revalidate` unless the route sets its own. The route cache wraps
the middleware: a hit is served with the headers stored on its miss. `server.ts` keeps
such a hit as bytes for one second per path (emptied by every non-GET request) and
answers it before the adapter. Static files keep
the adapter's headers. No `s-maxage`: the purge cannot reach Cloudflare. Public API
errors are `no-store`. `public/sw.js` only retires the old breathing app's service
worker, is revalidated on every load and goes after 2027-04-26 (docs/runtime.md).

**Generated files.** `sitemap()` lists `/sitemap-events.xml` in the index (`customSitemaps`);
that route is ours (EmDash's per-collection sitemap lists only collections with its SEO
panel), and `src/pages/sitemap.xml.ts` sends EmDash's `/sitemap.xml` to the index.
`src/pages/llms.txt.ts` prerenders a short index of the three public content pages.
No live-site fetching, Markdown export or post-build patching is needed. The brand
files are generated and committed (docs/brand/README.md): `brand/tokens.*` and
`brand/palette.*` from `theme.css` (`brand:export`), every logo, favicon and mail
mark from `brand/logo/logo.svg` (`brand:logo`). Never hand-edit them;
`tests/brand-export.test.ts` and `tests/brand-logo.test.ts` fail on drift. The
preview images `public/images/og-*.png` are plain committed files: the templates
that rendered them are gone (as are the print templates and the styleguide);
replace one by hand and bump its `?v=`.

**Images.** On prerendered pages, Astro's `<Image />` straight from `astro:assets`, no
wrapper component: `layout="constrained"` with `width`/`height` (Astro writes `srcset`
and `sizes`), `position` for the crop, Tailwind for the box (`image.responsiveStyles`
stays off). Photos live in `src/assets/images/`. SSR pages never use `<Image />`: it
would run sharp per request through `/_image`, which the middleware answers with 404 in
production. The home page uses pre-sized files beside the original with a written
`srcset`: the opening's photograph (`markus-kreis-{480,720,960}.avif`, square, AVIF q52)
and Markus's avatar (`markus-avatar-192.webp`); regenerate them when the photo
changes. Sharp is a build-time dev
dependency. All events use `/images/og-default.png`.

**Cron.** The plugin's cron, in process (EmDash's scheduler, UTC; scheduled on
`plugin:activate`): the reminder pass every 15 min, the retention at 02:30. No
`Bun.cron` (throws at boot) and no host-driven task. Reminders go out in Berlin
wall-clock time (`lib/server/reminder-window.ts`): 18:00–22:00 the evening before
("morgen"), else from 10:00 on the day until the start ("heute"), once per registration
(`reminder_sent_at`). Time: the admin stores `starts_at`/`ends_at` as instants; the site
works with a Berlin calendar day (`"2026-11-12"`) and `HH:MM` (`event-entry.ts`), and
every label, comparison, `.ics` and JSON-LD time comes from `lib/shared/time.ts`
(`formatDateLong`, `formatTimeRange` with one spelling, `zonedTime`, `isPast`,
`todayBerlin`). Never `getUTC*` on an event date. The retention anonymises the
registrations of events `RETENTION_DAYS` past (≤ `DEFAULT_RETENTION_DAYS`, the number
`/datenschutz` prints) and moves them to the trash; change the period in
`lib/shared/retention.ts` and the policy together. Logs never carry an address
(`logId()` in `listmonk.ts`). Beside `dist/`, the Docker image keeps the migration
script with `seed/` and `src/lib/shared/`, `src/data/`, the mail fonts
(`src/assets/mail`) and the production `dependencies`.

**Email.** Participant mails (confirmation with the calendar link, reminder) and the
admin's note of a registration go through EmDash's email pipeline (`ctx.email.send`;
SMTP from `EMAIL_SMTP_*` or Settings → Email; the console in `astro dev`). Their HTML is
in `lib/server/mail/` (one function per mail), the messages in `mail/index.ts`; a mail
that fails is logged and never fails the sign-up. Participant mails carry `cancelUrl`
(empty without `CANCEL_LINK_SECRET`; the templates then fall back to "write to us").
listmonk keeps only the newsletter (sign-up form, double opt-in, campaigns); its
campaign template is versioned in `listmonk-templates/` (edit there, paste into
listmonk). Mail colours come from `lib/shared/brand.ts`, which `tests/brand.test.ts`
holds equal to the `--p-*` primitives and to every hex in both template folders. The
brand name comes from `src/data/site.json` only. The templates load the mail mark from
`/images/logo-mail.png` by URL; mails already sent still load `/images/logo-flame.png`,
so keep both files.

**Map.** The BayernAtlas web component (`<bayern-atlas>`, `atlas.bayern.de/wc.js`,
an iframe; keyless). Its script loads only near the viewport, as a classic script:
`type="module"` needs CORS, which atlas.bayern.de grants only to localhost and a few
origins, so it worked locally and failed live; it reads its attributes
once, on connect, and takes commands (`addMarker`) only after `baLoad`. `c` is lon,lat.
Keep the attribution line under the map.

**Styling.** Tailwind v4 (`@tailwindcss/vite`), CSS-first. `styles/theme.css` holds the
tokens, variants, surfaces and keyframes; `global.css` (public, one shared hashed file)
is the entry. It reads classes from `src/` only (`source('..')`, so words in docs, mail
templates and tests never become utilities) and skips server-only code and the plugin
with `@source not`; EmDash's admin brings its own styles. Printing a page of the site (`@media print`) lives in `global.css`.
Reading text stays sharp as the page scrolls. The two scroll-linked bars use CSS view
timelines (`animation-timeline`); the FAQ is native `<details>`; no animation
script ships to the browser. The opening, page transitions, loops and
state transitions are the theme's own keyframes and `--animate-*` tokens (`rise`,
`skeleton`).
No `<style>` blocks and no component stylesheets: utilities in the
markup, recipes in `lib/ui.ts`, components in `components/ui/`. `docs/design-system.md`
is the reference. Class strings are complete and static; never add a class that sets a
property the component already sets (add a prop). Scripts hook onto `data-*`
attributes, never onto styling classes; states are `data-*` too (`data-open`,
`data-state`, `data-tone`).

## Design

- `docs/design-system.md` is the reference. The idea: the circle of chairs. A centre, things turned towards
  each other, much air; poster-sized type where the site invites, calm reading where
  it explains. The look is three colours and nothing else: paper (`#F4F1EA`) and
  ink (`#141210`), the two grounds and each other's text, and one accent
  (`#C8603A`, the glow in the middle of the circle: the mark, the one action, the
  italic phrase, an index number, a link's underline). Every other tone is paper
  and ink mixed (`color-mix`); every ground is flat, no gradient and no
  shadow, with one exception: the home opening, where four pale circles of the accent
  drift over the ink (`data-hero-glow`). Cormorant with its italic. Open and
  full-bleed: grounds from edge to edge, content between lines, no rounded card.
  The circle is the one motif, in four
  forms: the mark, the seat ring, the stamp, the index number. Same function, same
  component.
- Stance and voice (design-system.md): the page acts like a circle leader who holds
  the space instead of performing. Quiet, the frame visible (course, five
  agreements, consent, no therapy), grounded, open to every man. Copy: "du", plain
  German, no jargon, no "brother" tone, no promises of healing; no dashes for effect,
  slogan contrasts, triads or therapy phrases; each point once per page.
- Colours are roles (`ground`, `ground-alt`, `fg`, `fg-soft`, `fg-muted`,
  `line`, `line-strong`, `line-bold`, `accent`, `accent-strong` (the filled
  button under the pointer), `on-accent`, `danger` for a refusal only); the three
  hex primitives (`--p-paper`, `--p-ink`, `--p-accent`) live on `:root` only,
  mirrored in `lib/shared/brand.ts` (`tests/brand.test.ts`), never in markup.
  Never add a fourth hex: a new tone is a mix of these. The accent is one hex on
  every ground and holds 3:1, so it is large or drawn, never the colour of small
  text: a link is the text's colour on an accent underline, a filled button the
  accent under an ink label. Day and night follow the system
  (`light-dark()`); `ModeToggle` pins Auto · Hell · Dunkel as `data-mode`
  (`mc-appearance`). Every text pair ≥ 4.5:1 on every ground in both modes, control
  lines and the accent ≥ 3:1 (`tests/contrast.test.ts`, read from `theme.css`);
  `line` never outlines a control alone. Check new pairs in both modes.
- Grounds: `Section ground` is `default` (paper), `alt` (the band, paper with a
  little ink: facts, course, dates) or `dark`
  (`surface-dark`, ink in both modes, flat; it re-declares the roles with their
  night values: opening, agreements, voices, registration,
  menu, last band, footer). The site has these three grounds. Grounds
  run from edge to edge; `Section` clips horizontally what bleeds.
- Type: Cormorant variable, upright and italic (`font-display`, two files in
  `src/assets/fonts/`, local provider, from weight 500, figures lining via `lnum`;
  both faces `font-display: optional` with every file preloaded, never `swap` or
  `block`: a font arriving after the first paint re-lays the page out and flickers)
  for titles, dates, numbers, poster words; a light, narrow face, so its sizes run
  a step larger; Geist (`font-sans`, static regular and semibold) for text,
  navigation, forms, data. Role tokens
  `text-poster`, `text-hero`, `text-index`, `text-page`, `text-section`, `text-sub`,
  `text-quote`, `text-md` (body), `text-base` (controls). `<em>` in
  a title is Cormorant's italic in the accent. Labels in sentence
  case. Running text on `max-w-measure`. A dash in running copy is bound to the word
  before it (`\u00a0–`).
- The four moves, the only ways to break the 12-column grid, each at most once per
  section: the margin column (`margin` recipes in `lib/ui.ts`: side 1–3, content
  4–12, reading 4–10, a crossing title 1–10), the overlap (an opening's poster line
  across the foot of its photograph, where the photograph has run into the
  ground), the bleed (a photograph, the stamp or a ground runs to the window's
  edge) and the poster word (`Poster`, one per screen). Never: staircases,
  rotation, shadows, boxes or cards around content, text over a face, the sky or a
  busy part of a photograph.
- Shapes: open and square. Grounds, bands, the registration and the map have no
  radius. `rounded-full` for what you press and for circles (people's photographs,
  seat ring, stamp, avatar); single-line fields are pills at the buttons' heights; textareas use `rounded-xl`;
  only what floats (a dialog) takes `rounded-xl`. No rounded
  cards on public pages: facts, steps, agreements, FAQ and voices are rows between
  lines. No shadow anywhere; what floats has a line and the dimmed page behind it. Images: a photograph has no
  frame, it runs to the window's edge and softly into the ground
  (`data-hero-frame`); a small portrait stands in a circle; no caption.
- Skills are vendored in `.claude/skills/` (sources in `skills-lock.json`):
  `web-design-engineer`, `tailwind-animations` and the three animation skills named
  under Motion.
- Against the generated look (the `web-design-engineer` skill's failure patterns,
  `skills-lock.json`): no label above every heading (`Eyebrow` only where it adds the
  place or the kind of page), no decorative numbers (an index number only where
  there is a real order: the course, the agreements), no drawn shape standing in for
  a picture (no empty rings), no gradient, glow or texture on a ground but the home opening's glows, one label for one action, nothing invented.
- Shared components: `EventSummary` (every date: date, facts, `SeatRing`, action;
  fed by `lib/shared/event-status.ts`), `SeatRing` (`lib/shared/seats.ts`:
  `seatFill`, `seatDots`), `Stamp`, `Lockup` (`src/components/brand/`), `PageIntro`,
  `SectionHead`, `Poster`, `Index`, `Eyebrow`, `Fact`, `Button`, `Field` + `FormStatus`,
  `TestimonialList`, `Accordion`. Use them; do not restyle a copy.
- Home: the dark opening, one screen tall on desktop, set like a poster and without a picture
  (four pale circles of the accent on the ink, high and to the right, drifting:
  `data-hero-glow` in `Hero.astro`, its rules and keyframes `glow-a` to `glow-d` in
  `global.css`, "The opening"; the statement at poster size across the whole
  width, on plain ink, so keep the glows out of its lower left where the accent
  phrase stands; under it one row on the grid: explanation and the one action on
  the left, the next date as open lines on the right; the bar's action outlined
  over it; on phones date, time and place precede the action), Markus with a short introduction and portrait, intro
  (questions in the margin, the four facts as its last row), the statement on a
  screen of its own (`Statement`, the page's one scroll-led moment), course (the band,
  index numbers), agreements (dark),
  voices (dark, every voice in full), FAQ, taking part (`#termine`, "Dabei
  sein." as a poster word), staying in touch (dark, the stamp), the footer.
  Open and wide: no box or card on a public page, the opening included.
- Sub-pages open with `PageIntro`: on paper with the stamp, or, given a photograph
  (the personal page), as the home page's poster opening on the dark ground (`overHero`
  on the layout). Section titles are `text-section` everywhere on the home page.
- Header 72px: links from `nav`, one action; over the home opening clear with light
  text until the page moves (`data-scrolled`), then the opaque page ground. The phone menu is a native modal `<dialog>` on
  the dark ground, opening as a circle.
- Motion (design-system.md, "Motion"): calm, and every piece has a reason. What
  moves: the change of page, a fade and nothing else (cross-document view
  transitions, `@view-transition`); every page's opening arriving once on load, in about a
  second (`data-opening`: the title's words rise, the lead, actions and date fade
  up, a photograph settles from 1.05 and is never hidden: it is the LCP; CSS
  only, `global.css`, "The opening"; the seat ring's taken chairs fill in); the home opening's four pale circles drifting (`glow-a` to `glow-d`, translate and scale on layers of their own); the home statement turning to ink word by word as it crosses
  the window (`data-statement`, one view timeline, each word a slice of it); the stamp's ring of words turning
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
  `find-animation-opportunities`, refined for Astro and vanilla CSS/JS, and
  `tailwind-animations` for the package's classes): transforms and opacity, CSS first, then WAAPI, no animation script, UI
  under 300ms,
  the theme's own curves. Never add: a rise or slide on arriving at a page other than its opening's one arrival, a second
  scroll-linked effect on the same piece, pinning or scroll-jacking,
  anything that follows the pointer, anything that starts invisible on the first
  screen. Under reduced motion
  everything rests.
- Lighthouse on every motion change (design-system.md): CLS 0, no forced reflow,
  only opacity and transforms move.
  Never set a state attribute on `<html>` while the page moves; never read layout
  or `scrollY` at load (use an `IntersectionObserver`); nothing that holds the LCP
  waits for a script. No `content-visibility`.
- No layout shift: summary dates wrap on narrow screens; a title's measure is in
  `em`, never `ch`.
- Page transitions are a native cross-document cross-fade (`@view-transition`,
  `plus-lighter`, one duration, linear). No `:has()` on `body` or `html`.
- Styles live in the component's markup as utilities. `global.css` is one stylesheet
  for every public page, so keep one-off arbitrary values few.
- A token carries a trailing comment in `theme.css` (the token export reads it).

## Conventions

- Content and section order live directly in `src/pages/*.astro`; legal pages are
  explicit `impressum.astro` and `datenschutz.astro` routes. No content collections
  or JSON page content. Section components live in `src/components/blocks/`; pages
  pass their content explicitly as props and rich-text slots. Load dynamic data in
  server code or through the public JSON endpoints; blocks only render their inputs. Component-specific
  browser behavior belongs in its own `<script>` (Header, ModeToggle,
  BackToTop, ActionBar, EventDock), with no global client entry. Public form helpers stay
  in `lib/form.ts`. `Prose` accepts inline markup in its slot or
  an `html` prop for dynamic content. Static FAQ answers, journey steps and facts
  use slotted item components at their page location, rather than frontmatter arrays.
  FAQ and journey microdata describe the visible HTML directly, including dynamic
  event answers. `src/data/*.json` is shared site config.
- The brand name comes from `site.siteName`; never type it out.
- Canonical URLs come from `lib/canonical.ts`.
- Prefetch is one Speculation Rules block in `Layout.astro`: same-origin links on hover
  or press (Chromium), never `/admin`, `/_emdash` or `/api`. No Astro prefetch script and
  no per-link attributes.
- Search: every public page is indexed and in the sitemap, the legal pages and
  `/teile-deine-erfahrung` included; only `/_emdash` (EmDash's admin and API), the
  cancel page and the 404 stay out (`noindex` on the cancel page and the 404). llms.txt lists the
  three content pages. An event held outside Straubing names its
  place in the `<title>` (≤ 60 chars, brand dropped first). Structured data states only
  what the pages say (Person, `areaServed`); no FAQPage for rich results.
- JSON-LD ids (`#organization`, `#markus`, `#website`, `#series`) are defined once.
- Aliases: `@lib/*`, `@components/*`, `@data/*`.
- Layout ESLint enforces (`eslint.config.ts`; Prettier leaves it alone): a blank line
  after declarations (one-line ones may stand together), around `if`, loops,
  `switch` and `try`, and before `return`. Imports are sorted in groups: side
  effects, `node:`/`bun:`, `astro:` and packages, aliases, relative.
