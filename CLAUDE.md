# CLAUDE.md

Website for the Männerkreis. Astro 7 (no UI framework), SSR on the Bun runtime,
Drizzle on `bun:sqlite`, email via external listmonk, admin sign-in via Pocket ID.
Code, comments and docs are English; user-facing content is German.

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
get no images. Event pages are SSR. `lib/event-status.ts` has three states; a failed
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

**Map.** Leaflet on keyless OSM France HOT tiles (`TILE_URL`); keep the attribution.

## Design

- "Feuerstelle": warm, earthy, calm. Fraunces speaks (headlines, quotes, numbers;
  400, italic for emphasis), Instrument Sans explains (text, UI). Capitals only for
  small labels (`.marker`) and `.display--heavy` (Fraunces 900), a few words per page.
  Barlow is loaded for the admin only.
- Colours: cream `#F4EDE1`, bark `#241C17`, rust `#A84A2A` (4.9:1, may carry text and
  the cream label of a button), ember `#E07F57` at night, moss `#364132` once on the
  home page. Strong grounds are rare: bark (Ablauf, footer), moss (statement), rust
  (Termine, sub-page CTA).
- Surfaces (`.surface-sand|bark|moss|rust`) re-declare `--text-*`, `--accent`,
  `--on-accent`, `--border-*`, `--surface` and the control tokens; components only use
  those tokens, so buttons, links, focus rings and forms follow the ground. Surfaces
  keep the page's color-scheme, so their `light-dark()` grounds follow the mode.
- Layout: asymmetric two-column grids per block; `.spine` only for quiet passages and
  sub-pages. Phones get their own compositions (hero circle breaks out to the right,
  questions become a ladder, Markus' name comes before his photo).
- Vertical rhythm: `--rhythm-section` > `group` > `item` > `tight`; never inverted.
  Lift reserving `min-block-size` once columns stack or an island swaps in.
- The seat circle (`SeatCircle.astro`) is the mark: a hairline ring with seats and an
  ember. It frames the hero photo, sits at the centre of the questions, draws the
  seats of an event (taken/open), the logo and the footer. Never behind running text.
  Ring strokes use `non-scaling-stroke`, so never put dash arrays on them.
- Radius `--radius` (3px) on controls and panels; full circles only for seats, the
  theme and scroll-to-top buttons and the hero photo.
- Motion: hero entrance (words, circle), scroll-driven reveals (`[data-reveal]`,
  view() only, no JS, nothing hidden without timeline support), ring turn, the
  Ablauf dial (per-step view timelines via `timeline-scope`), statement settle,
  breath rings, header ground and progress. Only `opacity`/`transform`; all off under
  `prefers-reduced-motion`.
- View transitions are native; the cross-fade needs linear curves and one duration.
  The header has no `view-transition-name`.
- Block styles live in the component (`<style is:global>` in `@layer sections`), since
  CSS is inlined per page.

## Conventions

- Static content: `src/content/*.json`, `src/data/*.json`. Home blocks are dispatched by
  `PageContent.astro`; a new block needs a component and a case.
- The brand name comes from `site.siteName`; never type it out.
- Canonical URLs come from `lib/canonical.ts`.
- JSON-LD ids (`#organization`, `#markus`, `#website`, `#series`) are defined once.
- Aliases: `@lib/*`, `@components/*`, `@data/*`.
