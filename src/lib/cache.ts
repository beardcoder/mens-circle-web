/**
 * `Cache-Control` for the prerendered HTML documents.
 *
 * The adapter bakes whatever a prerendered page sets on `Astro.response.headers`
 * into `static-manifest.json` (it declares `adapterFeatures.staticHeaders`, and
 * Astro hands it `routeToHeaders` in `astro:build:generated`), so setting this
 * in a page's frontmatter is what actually ships on the served file.
 *
 * `max-age=0, must-revalidate` for the browser, `s-maxage` for a shared cache.
 * Two separate reasons, and they pull in opposite directions:
 *
 * - **Browsers must revalidate.** The HTML references per-build hashed assets
 *   (`/assets/page.<hash>.js`). A deploy replaces the image, so those URLs are
 *   gone from the origin the moment it goes live — HTML a browser held onto
 *   would ask for scripts that 404. The ETag makes the revalidation a 304, so
 *   this costs a round trip, not a re-download.
 * - **A CDN may serve it for `s-maxage`.** That is the whole point: it takes the
 *   origin out of the critical path for visitors far from the server. Kept short
 *   because the same stale-asset window applies at the edge — bounded by
 *   `s-maxage` after a deploy, and softened by the assets' own
 *   `max-age=31536000, immutable`, which usually keeps the old files alive in
 *   the edge cache long enough to serve that stale HTML correctly.
 *
 * **This is only safe while the build gets a stable `ASTRO_KEY`.** Server
 * islands (`server:defer`) carry their props encrypted in the HTML, and without
 * `ASTRO_KEY` Astro mints a fresh key per build (`core/build/index.js`:
 * `hasEnvironmentKey() ? getEnvironmentKey() : createKey()`). Cached HTML from
 * an older build then hits `/_server-islands/<name>` with props the new build
 * cannot decrypt, and the endpoint answers `400 Bad request: Encrypted props
 * value is invalid.` The island never swaps in and the visitor keeps the
 * fallback, which on the home page means live scheduling silently disappears.
 * That is why this used to be a flat `no-cache`. Drop the key and this constant
 * goes back to `'no-cache'` with it.
 *
 * `ASTRO_KEY` is a **build-time** variable only — it is encoded into the server
 * manifest (`core/build/plugins/plugin-manifest.js`, `key: encodedKey`) and the
 * running process reads it from there, never from its own environment. Setting
 * it on the container changes nothing; it has to be set for `astro build`.
 *
 * Note that Cloudflare does not cache HTML off these headers alone: its default
 * cache level goes by file extension, so a document stays `cf-cache-status:
 * DYNAMIC` until a Cache Rule marks it eligible. `s-maxage` is what that rule
 * then reads.
 */
export const PRERENDERED_CACHE_CONTROL = 'public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=60';
