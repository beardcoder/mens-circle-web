# Runtime and adapter

`@igloczek/astro-bun-adapter` (standalone mode) builds this Astro 7.4.2 project for
Bun's native HTTP server: requests go from `Bun.serve()` straight to Astro as
web-standard `Request`/`Response`, with no Node HTTP bridge. `server.ts` at the root
is the process Bun runs (`bun server.ts`, `HOST` and `PORT` work): it imports the
adapter's handler from `dist/server/entry.mjs` with the adapter's autostart off,
serves it with `Bun.serve()` as the adapter would, drains in-flight requests on
SIGTERM/SIGINT, and adds one header (below). Bun is also required by Drizzle's
`bun:sqlite` backend and the scheduler. The build bundles everything except
`bun:sqlite`, the adapter included, so the production `dependencies` are only what
the scheduled scripts import (`drizzle-orm`, plus `openid-client` for the server lib);
Astro, the adapter, Preact and Sharp are build-time dev dependencies. Keep the adapter
a dev dependency: in `dependencies` its `astro` peer would pull the whole build
toolchain into the image (256 MB instead of 30 MB).

## Requests

- **Static files** (prerendered pages, `public/`, build assets) are served by the
  adapter before Astro: ETag/304 and byte ranges everywhere, dotfiles and path
  traversal refused, `max-age=31536000, immutable` for hashed `/assets/`. The adapter
  sends no `Cache-Control` for the rest, so `server.ts` adds `public, max-age=0`
  (prerendered pages, `robots.txt`, `sw.js`, sitemaps are revalidated, as under the
  Node adapter). No middleware runs for them.
- **Unknown paths** get the prerendered 404 page from disk, also without middleware;
  retired URLs therefore redirect in `astro.config.mjs` (`redirects`).
- **Rendered routes** pass through the route cache (see `docs/public-api.md`), then
  `src/middleware.ts`: the `/admin` session guard (redirect to `/admin/login`, sets
  `locals.admin`) and the default `Cache-Control` from `src/lib/cache-policy.ts`.
  Actions additionally call `requireAdmin` themselves.
- **`/_image`** answers 404 in production. Prerendered pages get their image variants
  at build time; the SSR home page uses pre-sized AVIF and WebP files. Sharp never loads in the
  server process, and nobody can make it transform arbitrary sizes.

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
browser enforces both policies. `/admin` and `/auth` get a complete policy without
any third-party host on top.

HSTS belongs at the edge, not in the app: set
`Strict-Transport-Security: max-age=31536000; includeSubDomains` in Cloudflare
(SSL/TLS → Edge Certificates → HSTS) or in the Coolify proxy, once every subdomain
serves HTTPS.

Mail templates load three self-hosted fonts from another origin. Their URLs remain
`/fonts/mail/*.woff2`: an allow-listed endpoint reads `src/assets/mail` per request
(rare) and sets `Access-Control-Allow-Origin: *`, without cookies or authentication.
Docker copies these files explicitly.

Astro sessions are disabled: authentication uses signed cookies and OIDC, so the
adapter's filesystem session driver is unnecessary. The adapter body limit is 1 MiB.
Origin checks and the configured trusted forwarded host stay enabled.

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

Headers, redirects, the 404 page, the admin guard, CSRF origin checks and the
canonical URL behind the proxy are identical (checked side by side).

## Deployment

The Docker entrypoint and the persistent `/data` volume are unchanged; migrations run
on boot. `server.ts` drains in-flight requests on SIGTERM (Coolify) and exits within
the adapter's shutdown timeout (60 s). Take the usual SQLite backup before a rollout; the previous image
remains a rollback option while the schema is unchanged.

References: [`@igloczek/astro-bun-adapter`](https://github.com/Igloczek/astro-bun-adapter),
[Astro with Bun](https://docs.astro.build/en/recipes/bun/).
