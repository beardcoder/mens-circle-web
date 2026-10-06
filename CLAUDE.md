# CLAUDE.md

Website for the Männerkreis. Astro 7 (no UI framework), Tailwind CSS v4, SSR on the Bun
runtime, Drizzle on `bun:sqlite`, email via external listmonk, admin sign-in via Pocket ID.
Code, comments and docs are English; user-facing content is German.
Commit messages are English too, in Conventional Commits form (`fix(seo): …`).

## Commands

```bash
bun run dev            # daemonizes; bunx astro dev status|logs|stop
bun run build          # bun --bun astro build: Astro runs on Bun (≥ 1.4) for Bun.Image
bun run check          # astro check
bun run lint           # eslint; complexity ≤ 12, max-depth ≤ 4 are enforced
bun run format         # prettier; also run after db:generate (drizzle/meta is formatted)
bun test               # each *.fixture.ts case runs in its own Bun process
bun run db:generate    # after editing src/lib/server/db/schema.ts
```

Verify with `check` + `lint` + `test`. TypeScript stays on 6.x: `astro check` and
typescript-eslint refuse TS 7.

## Rules

**Runtime.** One Bun process (`dist/server/entry.mjs` from the workspace adapter
`packages/astro-bun`) serves static files, SSR, actions and admin. Static files are
`Bun.serve` routes (native ETag/304); POST and unknown paths fall through to Astro. No
compression in the app: the Coolify proxy and Cloudflare do it. `404.astro` is
prerendered; the adapter hands it to Astro from memory, so every 404, `/404` included,
keeps its status. The adapter stays generic: site policy goes in through its options in
`astro.config.mjs`. Migrations run on boot. `src/lib/server/*`
is server-only; never import it into client scripts.

**Tests.** A test that reads config must spawn a fixture with `--no-env-file` and an
explicit env; config is read at module load, so an in-process import measures `.env`.

**Actions.** Everything is an Astro Action (`src/actions/*`), merged flat in `index.ts`.
Public forms validate only in their Zod schema; `lib/form.ts` owns submit and field
errors (forms need JS). Admin scripts use `bindOnce` + `ok` from `lib/admin.ts`
(the admin runs `<ClientRouter />`). Mutating admin actions call `requireAdmin`.
Other endpoints: `/health`, `/sitemap-events.xml`, `/auth/*`, `/api/public/events/<slug>/ics`.

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

**Rendering.** Home is prerendered with exactly four `server:defer` islands
(`HomeEventStatus` ×2, `Facts`, `Testimonials`); fallbacks never read the DB, islands
get no images. The `HomeEventStatus` fallback sets the same lines as a scheduled date
(static words, same length or shorter), so the swap changes text, not height: no
layout shift. Text in the first screen that an island fills stays one fixed line. Event pages are SSR. `lib/event-status.ts` has three states; a failed
read (`unavailable`) must never render as "no date planned".

**Caching.** `lib/cache-policy.ts` is the one table (middleware + the adapter's `staticHeaders`);
routes with their own header are left alone. The four prerendered documents use
`PRERENDERED_CACHE_CONTROL` (`lib/cache.ts`, `s-maxage=300`), which is only safe with a
stable build-time `ASTRO_KEY`; without it, revert to `no-cache`.

**Generated files.** `publish-generated-files.mjs` must run after `sitemap()` and `llms()`:
it adds `/sitemap-events.xml` and `/event`. The adapter serves whatever is on disk at startup.
`astro-llms-md` excludes `event` and `health` so it never fetches the live site at build.

**Images.** `CropPicture` at build time only, through the adapter's Bun.Image service
(no Sharp). Bun.Image cannot crop and has no AVIF on Linux: variants are WebP/JPEG at the
source ratio (`fit: 'outside'`), and the block crops them with `aspect-ratio`,
`object-fit: cover` and `object-position`. Keep the `/_image` 404 override. All events
use `/images/og-default.png`.

**Cron.** Host-driven: Coolify runs `bun run scripts/schedule.ts` every minute; tasks
declare their own cron. No in-process timer and no `Bun.cron` (throws at boot).

**Email.** listmonk is external; this repo only integrates it. `lib/server/email.ts` is
the payload contract. Keep list/template IDs (incl. `events.listmonk_list_id`) stable.
`confirmation_sent_at` is set only when listmonk accepted the mail.
`listmonk-templates/` holds the versioned copies of the listmonk templates: edit
there, then paste into listmonk. The `template-contract` email test fails when a
template reads a `.Tx.Data` field its payload does not send. The templates load the
mail mark from `/images/logo-flame.png` by URL, so keep that file.

**Map.** Leaflet on keyless OSM France HOT tiles (`TILE_URL`); keep the attribution.
Leaflet's stylesheet sits in the `vendor` layer (`styles/leaflet.css`, declared first in
`global.css`), so the utilities on the map root win over it.

**Styling.** Tailwind v4 (`@tailwindcss/vite`), CSS-first. `styles/theme.css` holds the
tokens, variants, surfaces and keyframes; `global.css` (public, inlined into every page)
and `admin.css` are the two entries, and `global.css` keeps the admin sources out with
`@source not`. No `<style>` blocks and no component stylesheets: utilities in the
markup, recipes in `lib/ui.ts`, components in `components/ui/`. `docs/design-system.md`
is the reference. Class strings are complete and static; never add a class that sets a
property the component already sets (add a prop). Scripts hook onto `data-*`
attributes, never onto styling classes; states are `data-*` too (`data-open`,
`data-state`, `data-tone`).

## Design

- "Feuerstelle", set like the flyer: warm, earthy, direct. Fraunces (`font-serif`, a
  soft, warm old-style serif with an organic wobble) speaks: headlines at its regular
  weight (400), set large, in sentence case; small serif lines (h3–h5, names, terms)
  take 500. Its italic is the quiet voice for questions and quotes. Instrument Sans
  (`font-sans`) explains: text, UI, buttons and the date line. The admin uses the same
  two faces.
  A single long word is capped by its column (`cqi`: hero and page titles, step
  titles, facts, frame terms, "Dabei sein.", "Anmeldung"), never left to overflow.
  A dash in running copy is bound to the word before it (`\u00a0–`), so no line
  starts with one. Capitals for wide-spaced labels (`Eyebrow`), the date line (bold
  orange sans capitals) and the one poster slogan (the Statement block). Figures are
  lining.
- Colours: cream `#F4EDE1`, night `#151210`, flame `#E4632E` (5.4:1 on night; on cream
  only as fill or stroke), rust `#A84A2A` (4.9:1, the accent and button on cream).
  Grounds: night for the header, hero, Termine and footer; one flame field per page
  (night text on it); sand for quiet passages.
- Colours are semantic tokens (`ground`, `surface`, `fg`, `fg-soft`, `fg-muted`,
  `accent`, `line`, …); no hex in markup. Surfaces (`surface-sand|night|flame`, via
  `<Section ground>`) re-declare the semantic colours, so text, hairlines, buttons,
  focus rings and inputs inside follow the ground. Utilities read the tokens directly,
  so there are no alias tokens to re-declare. Surfaces keep the page's color-scheme, so
  their `light-dark()` grounds follow the mode.
- The mark is the original brush-stroke logo (`src/icons/logo.svg`, header and footer).
  `SeatCircle.astro` (hairline ring with seats) frames the round hero photo, sits in the
  middle of the questions and counts an event's seats (taken/open); keep clear space for
  its ring, which reaches 20% of the photo's width past it. No painted/brush rings, and
  no decorative ring ever runs behind text.
- Layout: one split line on every page. Wide screens (container up to 1680px) sit
  on a 12-column field (`--field`, `--field-gap`): the head (label and title, or a
  `.spine` rail heading set as a title) takes columns 1–5, the content runs from
  column 7 to the edge, its first line level with the title's. A head with nothing
  beside it may run wider (home hero, page heads without a lead). Groups of equals
  (Ablauf steps, agreements, facts, voices) stand level below, under hairlines.
  Sections are parted by their ground and by space, never by drawn rules. Every
  block fills its width: no half-empty rows, no element left alone in a column.
  Titles: the home hero sentence is the only `--display-1`; section and page
  titles take `--display-2`, essays and rail titles `--display-3`. Phones get their
  own order (sentence first, then the round photo breaking out to the right, then
  the reading and the date), stack every block left-aligned, and keep boxes on the
  page's edges (no bleed). `Split` is the split line, `SectionHead layout="split"` the
  title beside its lead; blocks place themselves with `lg:col-*` and, on phones, DOM
  order. The `width >= 56rem` block in `theme.css` widens gutters and section rhythm;
  the display sizes are fluid tokens (`text-display-1|2|3`).
- Vertical rhythm: `section` > `group` > `item` (spacing tokens: `py-section`,
  `mt-group`, …); never inverted.
  Lift reserving `min-block-size` once columns stack or an island swaps in.
- Radius `rounded-control` (3px) on controls and panels; full circles only for seats and the
  round icon buttons. Capital lines keep `line-height` ≥ 1 for umlaut dots.
- The header is solid night at all times (nothing scrolls visibly beneath it); its
  hairline fades in on scroll. No progress bar, no numbers in the navigation.
- Motion: hero entrance (words, photo opening, seats), scroll-driven reveals
  (`reveal`, view() only, no JS, nothing hidden without timeline support), the hero
  ring's turn, statement settle, and the phone menu: it opens as a circle from the
  toggle (`--nav-origin`, set by `lib/site-header.ts`), then each link rises out of
  its line; closing runs back quickly. Under reduced motion it
  only fades. Motion variants: `entrance:` (one-time, never after a view transition),
  `scroll-motion:` and `reveal` (scroll-driven), `animate-delay-*` (through the
  non-inheriting `--delay`).
- No enumerations: nothing on the public pages is numbered or bulleted (Ablauf,
  agreements, positions, register). Steps are told by placement (the Ablauf steps
  stand level, each on a hairline with a seat where it begins), roles and how-tos are written as sentences.
- The hero breathes (`BreathField.astro`, keyframes `breath-swell` and `breath-drift` in `theme.css`):
  three soft warm fields (flame, deep rust, amber; eased radial gradients, no blur, a
  still grain against banding) widen unevenly and shift a little on a 31 s phrase of
  three breaths — in shorter than out, a short rest, depth varying — while each turns
  slowly on its own period, so the form never repeats or restarts. Scrolling gives
  depth (`breath-parallax` on `translate`, scroll() timeline over the first screen):
  rust lags most, amber least. The fields are placed in `svh`, never in % of the hero:
  the hero grows when the date island swaps in, and a field moving with it is a
  layout shift. The field starts below the header (mask), so bar and
  hero stay one surface. `lib/breath.ts` pauses every `[data-breath]` element off
  screen; under reduced motion it rests, still, and does not move with scroll.
- Smaller breath (`Breath.astro`, keyframes `breathe`, 10 s: 4 in, 0.5 hold, 5 out, 0.5
  rest): rings inside the questions' circle, a light glow on the flame field and a small
  circle to breathe along. Glows stay faint enough that every contrast holds.
- View transitions are native; the cross-fade needs linear curves and one duration.
  The header has no `view-transition-name`.
- Styles live in the component's markup as utilities. `global.css` is inlined into every
  public page (`inlineStylesheets: 'always'`), so keep one-off arbitrary values few.

## Conventions

- Static content: `src/content/*.json`, `src/data/*.json`. Home blocks are dispatched by
  `PageContent.astro`; a new block needs a component and a case.
- The brand name comes from `site.siteName`; never type it out.
- Canonical URLs come from `lib/canonical.ts`.
- Search: utility pages (`/teile-deine-erfahrung`, `/auth/*`) are `noindex, follow` and
  stay out of the sitemap and llms.txt. An event held outside Straubing names its
  place in the `<title>` (≤ 60 chars, brand dropped first). Structured data states only
  what the pages say (Person, `areaServed`); no FAQPage for rich results.
- JSON-LD ids (`#organization`, `#markus`, `#website`, `#series`) are defined once.
- Aliases: `@lib/*`, `@components/*`, `@data/*`.
