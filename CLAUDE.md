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
bun run db:generate    # after editing src/lib/server/db/schema.ts
bun run knip           # unused files, exports and dependencies
```

Verify with `check` + `lint` + `format:check` + `test`; CI (`.github/workflows/ci.yml`)
runs those and `build`. TypeScript stays on 6.x: `astro check` and typescript-eslint
refuse TS 7. Dependabot auto-merges minor and patch bumps. For Astro questions, use the
`astro-docs` MCP server (`.mcp.json`).

## Rules

**Runtime.** One Bun process (`dist/server/entry.mjs` from the workspace adapter
`packages/astro-bun`) serves static files, SSR, actions and admin. Static files are
`Bun.serve` routes (native ETag/304); POST and unknown paths fall through to Astro. No
compression in the app: the Coolify proxy and Cloudflare do it. `404.astro` is
prerendered; the adapter hands it to Astro from memory, so every 404, `/404` included,
keeps its status. The adapter stays generic: site policy goes in through its options in
`astro.config.mjs`. Migrations run on boot. `src/lib/server/*`
is server-only; never import it into client scripts. Deployed as one Docker image on
Coolify (port 8090, SQLite on the `/data` volume); env vars are in `.env.example` and
the README. Retired URLs redirect in `astro.config.mjs` (`redirects`) or, when they go
to `/`, in `src/middleware.ts`; `trailingSlash: 'never'`.

**Tests.** A test that reads config must spawn a fixture with `--no-env-file` and an
explicit env; config is read at module load, so an in-process import measures `.env`.

**Actions.** Everything is an Astro Action (`src/actions/*`), merged flat in `index.ts`.
Public forms validate only in their action Zod schemas. `lib/form.ts` owns submit,
field errors and the result line for newsletter/testimonial forms (`FormStatus`).
The Preact registration form handles its own busy/error/success state and calls the
same `actions.register`; errors preserve inputs and success refreshes capacity. Forms
need JS and keep feedback at the form rather than a toast. They
go through `publicForm()` in `actions/forms.ts`: an in-process per-IP rate limit
(`lib/server/ratelimit.ts`, one more reason for a single replica), a honeypot field
(`website`) answered with a fake success, German messages, and no internal error
ever shown. Admin pages mount Preact workspaces with local state and native navigation.
`components/admin/useAdminTask.ts` handles busy state and inline feedback. All private
admin reads and mutations call `requireAdmin`; see `docs/admin-ui.md`.
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

**Rendering.** Home and `/event` are prerendered, with Preact client islands for
next-date summaries, event facts, the upcoming list and moderated testimonials.
They use shared browser requests in `components/event/usePublicData.ts`; no polling.
Date widgets hydrate on load; testimonials hydrate near the viewport. Date cards
render only after a successful read with an upcoming event; loading and empty states
render no card. Failed reads show a compact message with retry.
Single event pages retain SSR for metadata, JSON-LD and event copy, with live capacity
and a client-only registration island. `lib/server/public-data.ts` coalesces and caches
reads for 30 seconds (testimonials: five minutes); mutations invalidate its bounded
process cache. Public DTOs exclude precise addresses and participant information.
See `docs/public-api.md` for the response contract, ETags and freshness guarantees.
Failures are retriable 503s, distinct from an empty list or an unpublished event (404).
The existing registration action checks capacity transactionally; cached counts do
not reserve seats. Legal pages, personal page and testimonial form stay prerendered.

**Caching.** `lib/cache-policy.ts` supplies defaults (middleware + adapter static headers).
Prerendered pages use `PRERENDERED_CACHE_CONTROL`; individual event HTML and event
JSON permit 30 seconds in a shared cache. Public JSON browsers revalidate with ETags.
Admin and actions are `no-store`, as are public API errors. `public/sw.js` only retires
the old breathing app's service worker and is served `no-cache`.

**Generated files.** `sitemap()` lists `/sitemap-events.xml` in the index (`customSitemaps`).
`src/pages/llms.txt.ts` prerenders a short index of the three public content pages.
No live-site fetching, Markdown export or post-build patching is needed.

**Images.** Astro's `<Image />` straight from `astro:assets`, no wrapper component:
`layout="constrained"` with `width`/`height` (Astro writes `srcset` and `sizes`), `position`
for the crop, Tailwind for the box (`image.responsiveStyles` stays off). Photos live in
`src/assets/images/`. Both portrait pages are prerendered, so their image variants
are built ahead of time. Sharp is external to the bundle (`vite.ssr.external`) so its
native binding resolves. All events use `/images/og-default.png`.

**Cron.** Host-driven: Coolify runs `bun run scripts/schedule.ts` every minute; the two schedules
are direct UTC checks (reminders every 15 min, the S3 backup at
03:00 when `BACKUP_S3_*` is set). No in-process timer and no `Bun.cron` (throws at
boot). Beside `dist/` and `drizzle/`, the Docker image keeps only the three scheduled
scripts, `src/lib/server/` and the production `dependencies` (the build
bundles the rest): what those scripts and the server lib import at runtime must be in
there (other `src/lib` files as types only).

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

- `docs/design-system.md` is the reference; the brief behind it (DESIGN.md, 12 Oct
  2026): calm, warm, clear and contemporary — an invitation to a real meeting, never
  a stage. Meaning sets size; what belongs together stays together; decoration has
  one place (the circle); same function, same design. Flat and moving: clear
  grounds and thin lines, no shadows; openings rise in, blocks rise into view.
- Colours are roles (`ground`, `ground-alt`, `fg`, `fg-muted`, `line`, `line-bold`,
  `accent`, `fill`/`fill-strong`/`on-fill`, `success`/`danger` for states only); hex
  primitives (`--p-*`) live on `:root` only, never in markup. One palette; day and
  night are `data-mode` (`light-dark()` tokens), switched by `ModeToggle` in the
  footer and the phone menu. The boot script drops a stored `mc-theme`. Every text
  token ≥ 4.5:1 on every ground in both modes, `line-bold` ≥ 3:1; `line` never
  outlines a control alone. Check new pairs in both modes.
- Cards: with no date planned all upcoming-date islands render no card;
  failed reads keep their own compact error message.
- Grounds: `Section ground` is `default` (paper), `alt` (the quiet secondary ground:
  facts, agreements, the breath panel, the closing invitation, compact bands) or
  `dark` (`surface-dark`: the home opening and the footer only). No other bands.
- Type: Playfair Display (400) for chosen titles, short quotes and the date in a
  summary; DM Sans for text, navigation, forms, data, FAQ questions, list titles.
  Role tokens: `text-hero`, `text-page`, `text-section`, `text-sub`, `text-quote`,
  `text-md` (body), `text-base` (controls, data). Titles are one colour; the italic
  accent appears only in the home statement and the breath line.
  Labels are small spaced capitals (`label`) with no rules; buttons and navigation in
  normal case. Running text on `max-w-measure`. A dash in running copy is bound to
  the word before it (`\u00a0–`).
- Grid: 1200px of content (`max-w-page`), side margins 20 / 32 / 48px; `py-section`
  64 → 96px, `py-band` for compact bands; breakpoints `md` tablet, `lg` desktop, `nav`
  (1100px) header links. No section is forced to a screen's height.
- Shapes: fully round or square (no radius token). Round (`rounded-full`) is every
  control — buttons and fields as pills of the same heights, outline and focus
  (`button()` and `control()` share their sizes; a textarea keeps the curve at its
  corners, `rounded-[1.5rem]`), icon buttons, the FAQ indicator — and the circle itself;
  square is what holds — cards, panels, photos, the map, popovers. Flat: a card is a thin line (`card`), never a shadow,
  and carries one emphasis at most (no cap bar, no glow, no photo frame).
- Shared components: `EventSummary` (every date, fed by `lib/event-status.ts`),
  `PageIntro` (every sub-page opening, light), `SectionHead`, `Button`, `Field` +
  `FormStatus`, the testimonial island (one short featured quote, long voices fold), `Accordion`
  (every FAQ). Use them; do not restyle a copy.
- Home: the dark opening holds statement, explanation, the action (in the first
  screen at 1440 × 900) and the next date; then facts, intro with its questions,
  the four phases with the breath panel (`#haltung`), Markus at 5 : 7, agreements,
  voices, FAQ, taking part (`#termine`), staying in touch (`#newsletter`, WhatsApp as
  a link). `/event` lists every upcoming date; an event page puts the description
  beside the registration; legal pages are a title and one column.
- Header 72px: links visible from `nav`, "Termine" the one filled action; the phone
  menu is a native modal `<dialog>`. Over the home opening the bar is clear
  (`over-hero:`) until the page moves (`data-scrolled`), then opaque paper at once.
  The footer is compact and the same everywhere; it carries no invitation.
- Motion: interactions ~180ms (a button rises 2px, arrows slide, header links draw
  a line); openings rise in staggered (`entrance:animate-rise`, ≤ 260ms); blocks
  rise into view (`reveal`) and list lines draw across (`draw`), both on `view()`
  timelines, so what is on screen is complete and nothing waits on a script; the
  hero's rings breathe (no parallax); the breath circle's 10 s cycle matches
  its words (4 s in, 5 s out); the phone menu opens as a circle from its button.
  No `content-visibility`.
  Under reduced motion everything rests and the timed guide hides.
- No layout shift: every summary line is one line (`truncate`). Both Playfair styles are preloaded
  (the statement's phrase is italic); dropping one brings the shift back. A title's
  measure is in `em`, never `ch`: `ch` follows the font in use (0.5em in the fallback,
  0.6em in Playfair) and Chrome re-resolves it late, so the hero title broke onto a
  fourth line and back while the fonts swapped (CLS 0.27).
- View transitions are native; the cross-fade needs linear curves and one duration.
  The header has no `view-transition-name`.
- Styles live in the component's markup as utilities. `global.css` is inlined into
  every public page (`inlineStylesheets: 'always'`), so keep one-off arbitrary values
  few.

## Conventions

- Content and section order live directly in `src/pages/*.astro`; legal pages are
  explicit `impressum.astro` and `datenschutz.astro` routes. No content collections
  or JSON page content. Section components live in `src/components/blocks/`; pages
  pass their content explicitly as props and rich-text slots. Load dynamic data in
  server code or through the public JSON endpoints; blocks only render their inputs. Component-specific
  browser behavior belongs in its own `<script>` (Header, ModeToggle, Statement,
  BackToTop), with no global client entry. Public form helpers stay
  in `lib/form.ts`; admin helpers live beside their Preact components. `Prose` accepts inline markup in its slot or
  an `html` prop for dynamic content. Static FAQ answers, journey steps and facts
  use slotted item components at their page location, rather than frontmatter arrays.
  FAQ and journey microdata describe the visible HTML directly, including dynamic
  event answers. `src/data/*.json` is shared site config.
- The brand name comes from `site.siteName`; never type it out.
- Canonical URLs come from `lib/canonical.ts`.
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
