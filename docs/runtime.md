# Runtime and adapter

The official `@astrojs/node` standalone adapter builds this Astro 7.4.2 project. Bun
runs the generated `dist/server/entry.mjs` (`HOST` and `PORT` work); Bun is required by
Drizzle's `bun:sqlite` backend and the scheduler, the bundle itself needs no Node. The
build bundles everything except `bun:sqlite`, so the production `dependencies` are only
what the scheduled scripts import (`drizzle-orm`, plus `openid-client` for the server
lib); Astro, the adapter, Preact and Sharp are build-time dev dependencies.

## Requests

- **Static files** (prerendered pages, `public/`, build assets) are served by the
  adapter before Astro: ETag/304 everywhere, `max-age=31536000, immutable` for hashed
  `/assets/`. No middleware runs for them.
- **Unknown paths** get the prerendered 404 page from disk, also without middleware;
  retired URLs therefore redirect in `astro.config.mjs` (`redirects`).
- **Rendered routes** pass through the route cache (see `docs/public-api.md`), then
  `src/middleware.ts`: the `/admin` session guard (redirect to `/admin/login`, sets
  `locals.admin`) and the default `Cache-Control` from `src/lib/cache-policy.ts`.
  Actions additionally call `requireAdmin` themselves.
- **`/_image`** answers 404 in production. Prerendered pages get their image variants
  at build time; the SSR home page uses pre-sized WebP files. Sharp never loads in the
  server process, and nobody can make it transform arbitrary sizes.

Mail templates load three self-hosted fonts from another origin. Their URLs remain
`/fonts/mail/*.woff2`: an allow-listed endpoint reads `src/assets/mail` per request
(rare) and sets `Access-Control-Allow-Origin: *`, without cookies or authentication.
Docker copies these files explicitly.

Astro sessions are disabled: authentication uses signed cookies and OIDC, so the Node
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

## Deployment

The Docker entrypoint and the persistent `/data` volume are unchanged; migrations run
on boot. The standalone server uses its standard signal behaviour (no explicit
connection drain). Take the usual SQLite backup before a rollout; the previous image
remains a rollback option while the schema is unchanged.

References: [Astro Node adapter](https://docs.astro.build/en/guides/integrations-guide/node/),
[Astro with Bun](https://docs.astro.build/en/recipes/bun/).
