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

- "Abendlicht": warm, grounded, sturdy — a circle of men: firm and outdoorsy, never
  macho, never a wellness retreat. Warm paper by day, a warm dark by night
  (`data-mode`, `light-dark()` tokens). The photo of
  Markus leads the home page; the next date is a card (`HomeEventStatus`, `NextDate`)
  that every date page shows the same way.
- Type: Fraunces (`font-serif`, weight 600) speaks — titles in sentence case, set
  firm; quotes and questions in its italic at 400. Instrument Sans (`font-sans`)
  explains: text, UI. Labels are bold capitals spaced like a stamp
  (`tracking-label`): eyebrows (behind a short accent bar, `Eyebrow`), buttons, list
  terms, "Nächster Termin". `text-display-1` is the home sentence and the statement,
  page titles take `display-2`, section titles `display-2`/`display-3`. A dash in running copy is bound
  to the word before it (`\u00a0–`), so no line starts with one. Figures are lining.
- Colours are semantic tokens (`ground`, `ground-alt`, `raised`, `surface`, `fg`,
  `fg-soft`, `fg-muted`, `accent`, `accent-strong`, `accent-soft`, `line*`); no hex in
  markup. Rust (`#a3462a`) is the accent by day, ember (`#ec7a48`) by night; flame
  (`#e4632e`) is the mark. Every text token holds ≥ 4.5:1 on every ground, control
  borders (`line-bold`) ≥ 3:1. Grounds: the page's paper, a stone band
  (`surface-sand`) for quiet passages, dark bands (`surface-night`) for the statement
  and the home page's close, and the footer. Surfaces re-declare the semantic
  colours, so everything inside follows.
- The dark bands carry `Contours.astro`: contour lines of the hill country
  (`public/images/contours.svg`, square) in the accent at 20%, which keeps every text
  token above 4.5:1 even where a line runs behind it. Only on dark bands.
- Shapes: firm. Square-cut controls, buttons and cards (`rounded-control` 3px,
  `rounded-card` 4px), flat cards with a solid border (`card`/`panel` in
  `lib/ui.ts`) for self-contained units — the date, agreements, voices, forms,
  questions — never for running text. Heavy rules mark where something begins: the
  Ablauf steps and facts stand under a 2–3px rule in `fg`, the date cards carry a
  4px accent bar on top, quotes a 4px accent rule on the left. Circles only for
  seats and round icon buttons; `shadow-overlay` only on popovers.
- Layout: a 1248px container. Titles stand above their content; `Split` puts a head
  (title, note, contact line) beside its content where both earn a column (FAQ,
  Anfahrt, forms). Two-column blocks place themselves with `lg:col-*`; phones stack in
  DOM order. Groups of equals stand level in a grid (steps, agreements, voices, facts).
  Sections are parted by their ground and by space. Vertical rhythm: `section` >
  `group` > `item`; never inverted.
- The Ablauf steps are numbered `01`–`04` in large serif figures (an evening has an
  order); everything else is told in sentences, not bullets.
- `SeatCircle.astro` (hairline ring with seats) is the mark of the circle: it counts an
  event's seats (taken/open) on the date cards and sits on the questions card.
- The header is the page's paper at all times (nothing scrolls visibly beneath it);
  its hairline fades in on scroll. No numbers in the navigation.
- Motion: entrances on the openings (`entrance:`, never after a view transition),
  scroll-tied reveals (`reveal`, view() only, nothing hidden without timeline
  support), the seat circle's draw-in, a breathing circle to follow in the statement band
  (`Breath.astro`, `breathe`: 4 s in, 0.5 hold, 5 out, 0.5 rest), and the phone menu:
  it opens as a circle from the toggle (`--nav-origin`, set by `lib/site-header.ts`),
  then each link rises; closing runs back quickly. Under reduced motion everything
  rests; the menu only fades.
- No layout shift: an island's fallback sets the same lines as its loaded state; the
  hero date card rests on the photo (absolute) from `lg`.
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
