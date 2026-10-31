# CLAUDE.md

Website for the Männerkreis. Astro 7 with Preact TSX islands, Tailwind CSS v4, SSR on the Bun
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
bun run db:generate    # after editing src/lib/server/db/schema.ts
bun run knip           # unused files, exports and dependencies
```

Verify with `check` + `lint` + `format:check` + `test`; CI (`.github/workflows/ci.yml`)
runs those and `build`. TypeScript stays on 6.x: `astro check` and typescript-eslint
refuse TS 7. Dependabot auto-merges minor and patch bumps. For Astro questions, use the
`astro-docs` MCP server (`.mcp.json`).

## Rules

**Runtime.** One Bun process runs the official `@astrojs/node` standalone server
(`dist/server/entry.mjs`; Bun because of `bun:sqlite`, the bundle needs no Node): static
files (ETag/304, hashed `/assets/` immutable), SSR, actions and admin. The build bundles
everything but `bun:sqlite`. No compression in the app: the Coolify proxy and Cloudflare
do it. `404.astro` is prerendered; unmatched paths get it from disk and never reach the
middleware. `src/middleware.ts` guards `/admin` (a signed session, else the login; sets
`locals.admin`) and applies `lib/cache-policy.ts`. Migrations run on boot.
`src/lib/server/*` is server-only; never import it into client scripts. Deployed as one
Docker image on Coolify (port 8090, SQLite on the `/data` volume); env vars are in
`.env.example` and the README. Retired URLs redirect in `astro.config.mjs`
(`redirects`); `trailingSlash: 'never'`.

**Tests.** A test that reads config must spawn a fixture with `--no-env-file` and an
explicit env; config is read at module load, so an in-process import measures `.env`.

**Actions.** Everything is an Astro Action (`src/actions/*`), merged flat in `index.ts`.
Public forms validate only in their action Zod schemas. `lib/form.ts` owns submit,
field errors and the result line for newsletter/testimonial forms (`FormStatus`); it
loads the actions client on the first focus in the form, not with the page.
The Preact registration form handles its own busy/error/success state and calls the
same `actions.register`; errors preserve inputs. Forms
need JS and keep feedback at the form rather than a toast. They
go through `publicForm()` in `actions/forms.ts`: an in-process per-IP rate limit
(`lib/server/ratelimit.ts`, one more reason for a single replica), a honeypot field
(`website`) answered with a fake success, German messages, and no internal error
ever shown. Admin pages mount Preact workspaces with local state and native navigation.
`components/admin/useAdminTask.ts` handles busy state and inline feedback. All private
admin reads and mutations call `requireAdmin`; see `docs/admin-ui.md`.
Other endpoints: `/health`, `/sitemap-events.xml`, `/auth/*`, `/api/public/events/<slug>`
(live seats), `/api/public/events/<slug>/ics`, `/fonts/mail/*` (CORS for listmonk).

**Auth.** Pocket ID via `openid-client` (`lib/server/oidc.ts`): code flow with PKCE +
state, `client_secret_post` (Basic would form-encode the UUID client id). The callback
URL comes from `APP_URL`, not the request (proxy reads `http://`). Admission:
`OIDC_ADMIN_GROUP` or a verified `ADMIN_EMAIL`. `ADMIN_SESSION_SECRET` has no fallback
and needs ≥ 32 chars, otherwise no session is signed or trusted. Never add a default.

**CSRF.** `security.allowedDomains` (from `PUBLIC_SITE_URL`) lets Astro trust the
proxy's forwarded headers. Never fix a 403 with `checkOrigin: false`.

**Data.** A read-then-write under concurrency goes in a synchronous
`db.transaction(fn, { behavior: 'immediate' })` with no `await` inside (see
`claimSeat()`). Capacity is computed from `holdsASeat()` only. More than one web
replica on the same SQLite file is not supported.

**Rendering.** Home, `/event` and the event pages are SSR with no content hydration:
dates, seats and approved testimonials are in the HTML. They sit in Astro's route cache
(`memoryCache` in `astro.config.mjs`: keyed by path, query ignored, at most 64 entries).
A page calls `Astro.cache.set(PUBLIC_CACHE)` (`lib/server/public-data.ts`: 5 min + 5 min
stale-while-revalidate, tag `public`) only after complete reads; every action that
changes events, registrations or testimonials awaits `purgePublicCache(context)`, so
the lifetime only bounds what changes with the clock. A failed read is a 503 with
`no-store`; a testimonial-only failure renders the page without storing it. An empty
schedule shows the "in Planung" card, never the error. The registration island is
client-only and starts from the rendered snapshot; `components/event/usePublicData.ts`
re-reads `/api/public/events/<slug>` when the page returns into view after 30 s (no
polling, no preload). Public DTOs exclude precise addresses and participant data; see
`docs/public-api.md`. The registration action checks capacity transactionally; cached
counts do not reserve seats. Legal pages, personal page and testimonial form stay
prerendered.

**Caching.** `lib/cache-policy.ts` is the default for rendered responses (middleware):
admin, `/auth`, actions and server islands `private, no-store`; everything else
`public, max-age=0, must-revalidate` unless the route sets its own. The route cache wraps
the middleware: a hit is served with the headers stored on its miss. Static files keep
the adapter's headers. No `s-maxage`: the purge cannot reach Cloudflare. Public API
errors are `no-store`. `public/sw.js` only retires the old breathing app's service
worker and is revalidated on every load.

**Generated files.** `sitemap()` lists `/sitemap-events.xml` in the index (`customSitemaps`).
`src/pages/llms.txt.ts` prerenders a short index of the three public content pages.
No live-site fetching, Markdown export or post-build patching is needed.

**Images.** On prerendered pages, Astro's `<Image />` straight from `astro:assets`, no
wrapper component: `layout="constrained"` with `width`/`height` (Astro writes `srcset`
and `sizes`), `position` for the crop, Tailwind for the box (`image.responsiveStyles`
stays off). Photos live in `src/assets/images/`. SSR pages never use `<Image />`: it
would run sharp per request through `/_image`, which the middleware answers with 404 in
production. The home page uses pre-sized files beside the original with a written
`srcset`: the photo in its ring (`markus-kreis-{480,720,960}.avif`, square, AVIF q52)
and Markus's avatar (`markus-avatar-192.webp`); regenerate them when the photo
changes. Sharp is a build-time dev
dependency. All events use `/images/og-default.png`.

**Cron.** Host-driven: Coolify runs `bun run scripts/schedule.ts` every minute; the two schedules
are direct UTC checks (reminders every 15 min, the S3 backup at
03:00 when `BACKUP_S3_*` is set). No in-process timer and no `Bun.cron` (throws at
boot). Beside `dist/` and `drizzle/`, the Docker image keeps only the three scheduled
scripts, `src/lib/server/`, the mail fonts (`src/assets/mail`) and the production
`dependencies` (the build bundles the rest): what those scripts and the server lib
import at runtime must be in there (other `src/lib` files as types only).

**Email.** listmonk is external; this repo only integrates it. `lib/server/email.ts` is
the payload contract. Keep list/template IDs (incl. `events.listmonk_list_id`) stable.
`confirmation_sent_at` is set only when listmonk accepted the mail.
`listmonk-templates/` holds the versioned copies of the listmonk templates: edit
there, then paste into listmonk. The `template-contract` email test fails when a
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
tokens, variants, surfaces and keyframes; `global.css` (public, one shared hashed file)
and `admin.css` are the two entries. Both read classes from `src/` only
(`source('..')`, so words in docs, mail templates and tests never become utilities) and
skip server-only code; `global.css` keeps the admin sources out with `@source not`.
Entrances and scroll reveals are Motion (`components/Motion.astro`, a dev dependency
bundled into the client); loops and state transitions are the theme's own keyframes
and `--animate-*` tokens (`rise`, `fade-in`, `skeleton`); there is no animation plugin.
No `<style>` blocks and no component stylesheets: utilities in the
markup, recipes in `lib/ui.ts`, components in `components/ui/`. `docs/design-system.md`
is the reference. Class strings are complete and static; never add a class that sets a
property the component already sets (add a prop). Scripts hook onto `data-*`
attributes, never onto styling classes; states are `data-*` too (`data-open`,
`data-state`, `data-tone`).

## Design

- `docs/design-system.md` is the reference. The idea: a fire circle at the edge of
  the forest — calm, warm, grounded, an invitation to a real evening. Deep forest
  green for what draws you in, the ember of the logo for the one thing to do, linen
  for reading; the circle (the photo in a ring, three warm points, the date's seal,
  numbered steps, the breath above the hills) is the one motif. Same
  function, same component.
- Stance (design-system.md, "Stance" and "Voice"): the page acts like a circle
  leader who holds the space instead of performing. Quiet, the frame visible
  (course, five agreements, consent: every exercise is an offer, "no" is a good
  answer, no therapy), grounded rather than lofty, open to every man. Copy: "du",
  plain German, no jargon, no "brother" tone, no promises of healing; no dashes for
  effect, slogan contrasts, triads or therapy phrases, and each point once per page
  (design-system.md, "Voice").
- Colours are roles (`ground`, `ground-alt`, `tint`, `raised`, `fg`, `fg-soft`,
  `fg-muted`, `line`, `line-strong`, `line-bold`, `accent`, `accent-soft`,
  `fill`/`fill-strong`/`on-fill`, `glow` for decoration, `success`/`danger` for
  states only); hex primitives (`--p-*`) live on `:root` only, never in markup. Day
  and night follow the system by default (`light-dark()` tokens, no `data-mode`);
  `ModeToggle` (footer and phone menu) offers Auto · Hell · Dunkel and pins a choice
  as `data-mode` (stored as `mc-appearance`). The boot script drops the old keys
  `mc-theme` and `mc-mode`, so earlier pins return to Auto once. `theme-color` comes
  as a light and a dark tag by `media`. Every text
  pair ≥ 4.5:1 on every ground in both modes, control lines ≥ 3:1; `line` never
  outlines a control alone. Check new pairs in both modes.
- Grounds: `Section ground` is `default` (linen), `alt` (sand: facts that belong
  together, the course, the dates), `tint` (sage: agreements, quiet notes) or `dark`
  (`surface-dark`, forest: the opening, the breath, the registration, the menu, the
  footer). Grounds run from edge to edge: square, no inset, no sheet.
- Type: Fraunces 500 (`font-display`, one static face) for titles, quotes, dates,
  numbers in circles; Figtree (`font-sans`, variable) for text, navigation, forms,
  data. Role tokens `text-hero`, `text-page`, `text-section`, `text-sub`, `text-quote`,
  `text-md` (body), `text-base` (controls). No italic display face: `<em>` in a title
  turns the accent, upright. Labels in sentence case: `Eyebrow` (ember dot, accent),
  `label` (muted). Running text on `max-w-measure`. A dash in running copy is bound
  to the word before it (`\u00a0–`).
- Shapes: soft and round. `rounded-full` for what you press and for circles; fields
  `rounded-md` with the buttons' heights (`button()` and `control()` share sizes);
  the map `rounded-xl`; the registration panel `rounded-2xl` (runs out to the right
  window edge beside the intro). No cards on public pages, not even for a date: the
  date is open too (seal, facts as small columns, seat bar). Everything stands open
  on its ground: facts, questions,
  agreements, FAQ and voices are rows or columns between lines, a quote stands
  behind an ember rule, a note is a heading and its text. Never wrap content in a
  box to group it; part it by a line or space. `shadow-overlay` only for what floats.
- Grid: 1200px of content and one edge, 28 / 40 / 56px from the window in every
  section (`Container`, `px-gutter`), and wide, open space: `py-section` 88 → 144px.
  `p-card` for the calendar dialog, `p-panel` (28 → 48px) for the registration,
  which below `lg` becomes a full-width forest band. `py-band` for compact bands;
  breakpoints `md` tablet, `lg` desktop, `nav` (1100px) header links. No section is
  forced to a screen's height.
- Shared components: `EventSummary` (every date, open: seal, facts, `SeatBar`; fed
  by `lib/event-status.ts`, the bar by `lib/seats.ts`, which the registration panel
  shares), `PageIntro` (every sub-page opening), `SectionHead`, `Eyebrow`,
  `Fact`, `Button`, `Field` + `FormStatus`, `TestimonialList`, `Accordion` (every
  FAQ). Use them; do not restyle a copy.
- Home: the forest opening holds statement, explanation, the action (in the first
  screen at 1440 × 900), the photo in its ring and the next date overlapping it; then
  the facts between lines, the intro with the first round's questions as a quiet
  list, the four steps on a path, the breath above the hills (`#haltung`), Markus
  (quote behind an ember rule, signed with his avatar), the five agreements as a
  numbered list, voices, FAQ, taking part (`#termine`), staying in touch
  (`#newsletter`).
- Header 72px: links visible from `nav`, one filled action; over the home opening the
  bar is clear (`over-hero:`) until the page moves (`data-scrolled`), then linen over a
  blur. The phone menu is a native modal `<dialog>` on the forest, opening as a circle.
- Motion: motion.dev in `components/Motion.astro` (`motion/mini` `animate`,
  `inView`, `scroll`, `spring`, `stagger`; springs without overshoot). On load the
  opening's title rises word by word (`data-enter="words"`, words wrapped on the
  server by `lib/words.ts`), the rest follows in order (`data-enter`), the photo
  settles (`settle`) and its ring follows (`ring`); sections rise in once in view
  (`data-reveal`, `data-reveal-group`, the steps' path `data-line`), the seat bar
  fills (`data-seat-fill`), the hero photo trails the scroll (`data-parallax`).
  Hidden states live in `global.css` under `[data-motion]`, which the boot script
  sets only with motion allowed and drops after 3 s if the script never started.
  CSS keeps the loops: the glow breathes (`data-glow`), the ring turns every 90 s.
  Third-party scripts are `async`, so nothing queues before the opening. On phones
  the home page has a bottom `ActionBar` with the next date once the hero's action
  is gone. Interactions ~180ms (a button rises 2px, arrows slide, header links draw
  a line); the breath's 11 s cycle (5.5 s in, 5.5 s out: resonance breathing) runs
  only on request; the event title flies into its dock on a scroll timeline. No
  `content-visibility`. Under reduced motion everything rests.
- Fonts: Fraunces 500 static (~18 kB) and Figtree variable (~20 kB); both upright
  faces preload, Figtree's italic loads when used.
- No layout shift: every summary line is one line (`truncate`); a summary under
  24rem (container query) puts the seal beside its label and the date below it. A
  title's measure is in `em`, never `ch` (`ch` follows the font in use and
  re-resolves when it swaps).
- View transitions are native; the cross-fade needs linear curves and one duration.
  The header has no `view-transition-name`.
- Styles live in the component's markup as utilities. `global.css` is one stylesheet
  for every public page (`inlineStylesheets: 'auto'`), so keep one-off arbitrary
  values few.

## Conventions

- Content and section order live directly in `src/pages/*.astro`; legal pages are
  explicit `impressum.astro` and `datenschutz.astro` routes. No content collections
  or JSON page content. Section components live in `src/components/blocks/`; pages
  pass their content explicitly as props and rich-text slots. Load dynamic data in
  server code or through the public JSON endpoints; blocks only render their inputs. Component-specific
  browser behavior belongs in its own `<script>` (Header, ModeToggle, Statement,
  BackToTop, Motion), with no global client entry. Public form helpers stay
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
- Search: utility pages (`/teile-deine-erfahrung`, `/auth/*`) are `noindex, follow` and
  stay out of the sitemap and llms.txt. An event held outside Straubing names its
  place in the `<title>` (≤ 60 chars, brand dropped first). Structured data states only
  what the pages say (Person, `areaServed`); no FAQPage for rich results.
- JSON-LD ids (`#organization`, `#markus`, `#website`, `#series`) are defined once.
- Aliases: `@lib/*`, `@components/*`, `@data/*`.
- Layout ESLint enforces (`eslint.config.ts`; Prettier leaves it alone): a blank line
  after declarations (one-line ones may stand together), around `if`, loops,
  `switch` and `try`, and before `return`. Imports are sorted in groups: side
  effects, `node:`/`bun:`, `astro:` and packages, aliases, relative.
