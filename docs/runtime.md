# Runtime and adapter

`@igloczek/astro-bun-adapter` (standalone mode) builds this Astro 7.4.2 project for
Bun's native HTTP server: requests go from `Bun.serve()` straight to Astro as
web-standard `Request`/`Response`, with no Node HTTP bridge. `server.ts` at the root
is the process Bun runs (`bun server.ts`, `HOST` and `PORT` work): it imports the
adapter's handler from `dist/server/entry.mjs` with the adapter's autostart off,
serves it with `Bun.serve()` as the adapter would, drains in-flight requests on
SIGTERM/SIGINT, and adds one header (below). EmDash runs inside the same process: its
admin, API and the site's plugin (`src/plugin`, with its in-process cron) are part of
the Astro build, and it reads SQLite through `node:sqlite`, which Bun provides. The
build bundles everything, the adapter included; the production `dependencies` are
EmDash (its CLI runs the one-off migration in the image) and React, which its admin
needs. Astro, the adapter and Sharp are build-time dev dependencies. Keep the adapter
a dev dependency: in `dependencies` its `astro` peer would pull the whole build
toolchain into the image.

## Requests

- **Static files** (prerendered pages, `public/`, build assets) are served by the
  adapter before Astro: ETag/304 and byte ranges everywhere, dotfiles and path
  traversal refused, `max-age=31536000, immutable` for hashed `/assets/`. The adapter
  sends no `Cache-Control` for the rest, so `server.ts` adds `public, max-age=0`
  (prerendered pages, `robots.txt`, `sw.js`, sitemaps are revalidated, as under the
  Node adapter). No middleware runs for them.
- **Route-cache hits** are kept by `server.ts` as bytes for one second per path and
  answered before the adapter (its file lookups and streamed body cost about seven
  times the CPU). Any request that is not a GET or HEAD empties that store, so a purge
  by an action is at most one second late.
- **Unknown paths** get the prerendered 404 page from disk, also without middleware;
  retired URLs therefore redirect in `astro.config.mjs` (`redirects`).
- **Rendered routes** pass through the route cache (see `docs/public-api.md`), then
  EmDash's middleware (runtime, its admin session) and `src/middleware.ts`: the CSRF
  origin check (EmDash turns Astro's `checkOrigin` off and guards only `/_emdash`) and
  the default `Cache-Control` from `src/lib/cache-policy.ts`.
- **`/_image`** answers 404 in production. Prerendered pages get their image variants
  at build time; the SSR home page uses pre-sized AVIF and WebP files. Sharp never loads in the
  server process, and nobody can make it transform arbitrary sizes.

## Expiring pieces

- `public/sw.js` retires the old breathing app's service worker (added 2026-10-26).
  Delete it after 2027-04-26.

## Security headers

`server.ts` adds to every response (static files included) `X-Content-Type-Options:
nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
a `Permissions-Policy` that denies camera, microphone, geolocation, payment and USB,
and a Content Security Policy with `frame-ancestors 'none'; object-src 'none';
base-uri 'self'`. A route may set its own `Referrer-Policy` (the cancel link sends
`no-referrer`). The page policy itself comes from Astro (`security.csp` in
`astro.config.mjs`): `default-src 'self'`, scripts by hash plus BayernAtlas and the
analytics host when configured, the map's iframe, fonts and images from the site.
On rendered pages Astro sends it as a header, on prerendered ones as a `<meta>`; the
browser enforces both policies. EmDash sends its own complete policy for `/_emdash`.

HSTS belongs at the edge, not in the app: set
`Strict-Transport-Security: max-age=31536000; includeSubDomains` in Cloudflare
(SSL/TLS → Edge Certificates → HSTS) or in the Coolify proxy, once every subdomain
serves HTTPS.

Mail templates load three self-hosted fonts from another origin. Their URLs remain
`/fonts/mail/*.woff2`: an allow-listed endpoint reads `src/assets/mail` per request
(rare) and sets `Access-Control-Allow-Origin: *`, without cookies or authentication.
Docker copies these files explicitly.

Astro sessions hold EmDash's signed-in admin: a file driver beside the database
(`sessions/` next to `DATABASE_PATH`). The adapter body limit is 1 MiB. The configured
trusted forwarded host stays enabled; the origin check lives in `src/middleware.ts`.

## Memory

Measured locally with the built server under Bun and a disposable database, 1,200
requests over home, `/event`, an event page and its JSON, plus a portrait request every
120 requests (as new visitors would load it):

| Build                                  | RSS at start | RSS after |
| -------------------------------------- | ------------ | --------- |
| On-demand portrait through `/_image`   | 58 MB        | 138 MB    |
| Pre-sized portrait, `/_image` disabled | 62 MB        | 86 MB     |

After 6,000 requests the second build holds about 90 MB, so it levels off. Bun's
`--smol` heap made no measurable difference (89.8 vs 89.6 MB) and is not used.

## Adapter comparison

Measured locally (4 cores, 32 concurrent connections, 3 s per path, route cache warm),
the same build with each adapter:

| Path                        | `@astrojs/node`        | Bun adapter + `server.ts` |
| --------------------------- | ---------------------- | ------------------------- |
| `/assets/*.css`             | ~7,600 req/s, p99 12ms | ~10,700 req/s, p99 8ms    |
| `/impressum` (prerendered)  | ~9,200 req/s           | ~11,500 req/s             |
| `/api/public/events/<slug>` | ~9,600 req/s           | ~14,300 req/s             |
| `/` (route cache)           | ~3,500 req/s           | ~4,100 req/s              |
| RSS after the load          | 141–146 MB             | 85–87 MB                  |
| Boot to `/health`           | 110–126 ms             | 70–93 ms                  |

Headers, redirects, the 404 page, CSRF origin checks and the
canonical URL behind the proxy are identical (checked side by side).

## Deployment

The image is built on `oven/bun:1.4-slim` (a minor version, so a rebuild picks up
patches but never a new minor; raise it on purpose). The entrypoint starts as root only
to hand the `/data` volume to the unprivileged `bun` user (uid 1000; a volume created
by an older image belongs to root), then runs the server as `bun` (`setpriv`). Run
anything by hand with `docker exec -u bun`, so the database and its WAL files always
belong to one user. No `ASTRO_KEY`: the site has no
server islands. `/health` reads the events collection and answers 503 when the
database cannot be read, so the Docker HEALTHCHECK sees a broken volume.

The persistent `/data` volume keeps the database (`emdash.db`, baked into the build as
`DATABASE_PATH`) and the admin sessions; EmDash runs its migrations on the first request. `server.ts` drains in-flight requests on SIGTERM (Coolify) and exits within
the adapter's shutdown timeout (60 s). Back up `/data` before a rollout; the previous image remains a rollback option while
the schema is unchanged.

References: [`@igloczek/astro-bun-adapter`](https://github.com/Igloczek/astro-bun-adapter),
[Astro with Bun](https://docs.astro.build/en/recipes/bun/).
