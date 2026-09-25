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
    compress: true, // default
  }),
});
```

`bun run dist/server/entry.mjs` starts the server; `HOST` and `PORT` override the config.

## What Bun does natively

- **Static files** are `routes` entries, so they never reach Astro. Small files are
  static `Response`s held in memory: Bun answers ETag, `If-None-Match` → 304 and HEAD
  itself. Files above 1 MB are file routes (sendfile, `Last-Modified`).
- **Compression**: text files (HTML, CSS, JS, SVG, XML, JSON, Markdown) are compressed
  once at startup with `Bun.zstdCompressSync` and `Bun.gzipSync` and negotiated per
  request (`Vary: Accept-Encoding`, one ETag per encoding).
- **Methods**: routes are registered for GET and HEAD only; a POST to a page and every
  unknown path fall through to the `fetch` handler, i.e. to Astro (middleware, CSRF, 404).
- **Shutdown**: SIGTERM/SIGINT call `server.stop()`, which lets in-flight requests finish.
- `server.requestIP()` becomes `Astro.clientAddress`; prerendered 404/500 pages are read
  from disk instead of fetched over HTTP.

## Build

The integration runs under Node (Astro builds with Node), so `src/index.ts` uses `node:*`
only. After every other integration's `astro:build:done` it writes
`dist/server/static-headers.json`: per file, the `staticHeaders()` result plus the headers
a prerendered page set itself (those win). Paths are resolved relative to the bundle, so
`dist/` can be moved.

The package ships TypeScript source and is bundled into the server entry by Vite. To
publish it separately, add a build step that emits JS.
