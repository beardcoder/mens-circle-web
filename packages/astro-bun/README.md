# @mens-circle/astro-bun

Astro 7 adapter that runs the SSR build on `Bun.serve`. It lives in this repo as a
workspace so it can later move to its own repository unchanged.

```js
import bun from '@mens-circle/astro-bun';

export default defineConfig({
  output: 'server',
  adapter: bun({
    staticHeaders: (pathname, { assets }) => (pathname === '/sw.js' ? { 'cache-control': 'no-cache' } : null),
    staticCacheControl: 'public, max-age=86400, must-revalidate', // default
  }),
});
```

`bun run dist/server/entry.mjs` starts the server; `HOST` and `PORT` override the config.

## What Bun does natively

- **Static files** are `routes` entries, so they never reach Astro. Small files are
  static `Response`s held in memory: Bun answers ETag, `If-None-Match` → 304 and HEAD
  itself. Files above 1 MB are file routes (sendfile, `Last-Modified`).
- **No compression**: responses leave uncompressed; the reverse proxy or CDN in front
  (Traefik, Cloudflare) compresses them.
- **Methods**: routes are registered for GET and HEAD only; a POST to a page and every
  unknown path fall through to the `fetch` handler, i.e. to Astro (middleware, CSRF, 404).
- **Trailing slash**: a page (`/a/index.html`, `/a.html`) is registered as `/a` under
  `trailingSlash: 'never'`, `/a/` under `'always'`, both under `'ignore'`. The other
  form falls through to Astro, which answers it with a 301 (308 for other methods).
- **Charset**: text files get `;charset=utf-8`, also when a prerendered page's own
  headers name `text/html` without one.
- **Shutdown**: SIGTERM/SIGINT call `server.stop()`, which lets in-flight requests finish.
- `server.requestIP()` becomes `Astro.clientAddress`.
- **Error pages**: a prerendered `404.html`/`500.html` is not a static route (it would
  answer `/404` with 200). It is held in memory and handed to Astro through
  `prerenderedErrorPageFetch`, so every 404 keeps its status and its file's headers.

## Image service

`bunImageService()` replaces Sharp with `Bun.Image` (Bun ≥ 1.4) for Astro's build-time
images. Astro must run on Bun for it: `bun --bun astro build`.

```js
import bun, { bunImageService } from '@mens-circle/astro-bun';

export default defineConfig({ adapter: bun(), image: { service: bunImageService() } });
```

Bun.Image resizes, but cannot crop. `fit: 'cover'` with a different aspect ratio is
therefore refused rather than stretched; ask for `fit: 'outside'` (the smallest size
that covers the box, source ratio kept) and crop with `object-fit: cover` in CSS.
JPEG, PNG and WebP encode everywhere; AVIF needs an OS encoder that Linux lacks.

## Build

`src/index.ts` sticks to `node:*`, so the integration also works when Astro runs on
Node. After every other integration's `astro:build:done` it writes
`dist/server/static-headers.json`: per file, the `staticHeaders()` result plus the headers
a prerendered page set itself (those win). Paths are resolved relative to the bundle, so
`dist/` can be moved.

The package ships TypeScript source and is bundled into the server entry by Vite. To
publish it separately, add a build step that emits JS.
