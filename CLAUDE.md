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
`@source not`. Animations come from `tailwind-animations` (CSS only, imported before
`theme.css`, which re-times the ones in use to the theme's easing; its skill is in
`.claude/skills/`, which both entries keep out with `@source not`, or its example
classes would ship). Its `.animate-dialog` block is always emitted (~1 KB inlined).
No `<style>` blocks and no component stylesheets: utilities in the
markup, recipes in `lib/ui.ts`, components in `components/ui/`. `docs/design-system.md`
is the reference. Class strings are complete and static; never add a class that sets a
property the component already sets (add a prop). Scripts hook onto `data-*`
attributes, never onto styling classes; states are `data-*` too (`data-open`,
`data-state`, `data-tone`).

## Design

- The look of the earlier hand-written design (commit b286281), rebuilt on Tailwind:
  warm earth and terracotta, a fire just out of sight — a circle of men, grounded and
  calm, never macho, never a wellness retreat. `docs/design-system.md` is the
  reference.
- Palettes: OKLCH primitives (`--p-*`) on `:root`; `warm` (earth, terracotta) is the
  default, `cool` (`:root[data-theme='cool']`, spruce and fern) re-pitches only the
  primitives. Day and night are `data-mode` (`light-dark()` tokens). Both are set
  before first paint and switched by `ThemeSwitch` (flame/leaf, sun/moon).
- Colours are semantic tokens (`ground`, `ground-alt`, `raised`, `surface`, `fg`,
  `fg-soft`, `fg-muted`, `accent*`, `fill*`/`on-fill`, `line*`); no hex in markup.
  `accent` is terracotta as text, `fill` the terracotta of buttons, seats and bars.
  Every text token holds ≥ 4.5:1 on every ground, control borders (`line-bold`)
  ≥ 3:1; check new pairs in both palettes and both modes.
- Grounds (`Section ground`): paper; `alt` parchment; `sand` the stone band (88%
  opaque, so the breathing light runs on beneath it); `night` deep earth with grain
  (openings, the journey, registration); `earth` the brown panel; `forest` the
  WhatsApp band; `ink` the footer. Surfaces re-declare the semantic colours, so
  everything inside follows.
- Openings are dark: `HeroFrame` (two warm glows, breathing hairline `Rings`, the
  container's edges as faint frame lines with a label set on end in each, `data-hero`).
  Home fills the first screen, an event takes `tall`, sub-pages (`PageOpening`)
  `auto`, with a photo beside the text where there is one. On scroll the content
  lifts away and the rings drift down. The header is glass on the paper and light
  and clear over an opening (`over-hero:`, `data-scrolled`).
- Type: Playfair Display (`font-serif`, weight 400, tracked in) speaks — titles in
  sentence case; a phrase of a title in the italic accent (`<em>`, via
  `titleEmphasis`); quotes and questions in the italic. DM Sans (`font-sans`)
  explains: text, UI. Eyebrows are spaced capitals (`tracking-eyebrow`) behind a long
  fading rule; buttons and labels bold capitals (`tracking-label`). A dash in running
  copy is bound to the word before it (`\u00a0–`), so no line starts with one.
- Shapes: pill buttons (`rounded-full`, lift and glow on hover), soft cards
  (`rounded-card` 12px, `shadow-card`) for self-contained units — the date, forms —
  never for running text; the date cards carry a 4px `fill` bar on the left. Groups
  of equals stand in hairline grids (facts with a faint watermark word, agreements,
  values, voices, link rows). The Ablauf steps are numbered `01`–`04` in large serif
  figures on the dark band; everything else is told in sentences.
- `HalfBleed` puts the reading on the paper beside a brown panel to the screen's edge
  (Intro). The FAQ is a list between hairlines with a round plus that turns. Voices
  (`Quote`) are never cards. Seats are counted by `SeatMeter` (a row of bars, taken
  filled) beside the count in words.
- Layout: a 1400px container. Titles stand above their content; `Split` puts a head
  beside its content where both earn a column. Phones stack in DOM order. Vertical
  rhythm: `section` > `group` > `item`; never inverted.
- Motion: entrances on the openings (`entrance:`, never after a view transition),
  scroll-tied reveals (`reveal`, view() only), the rings breathing out of phase
  (`ring`, `ring-slow`), the page's background breath (`BreathBackdrop`), the 10 s
  guide in the statement (`breathe`), the menu: a full-screen dark overlay that opens
  as a circle from its toggle (`--nav-origin`), links rising. No numbers in the
  navigation. Under reduced motion everything rests.
- No layout shift: an island's fallback sets the same lines as its loaded state; the
  date card's lines are each one fixed line (`truncate`). Both Playfair styles are
  preloaded (the hero title's accent is italic); dropping one brings the shift back.
- View transitions are native; the cross-fade needs linear curves and one duration.
  The header has no `view-transition-name`.
- Styles live in the component's markup as utilities. `global.css` is inlined into
  every public page (`inlineStylesheets: 'always'`), so keep one-off arbitrary values
  few.

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
