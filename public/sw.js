/**
 * Service worker for the installable breathing app (Atemübung).
 *
 * Scope is the whole origin, so the strategy stays conservative to keep the SSR
 * site fresh:
 *
 *   - app navigation  → network-first, then the cached app document
 *   - other pages     → network only (never stale scheduling HTML)
 *   - hashed assets   → cache-first
 *   - mutable assets  → stale-while-revalidate
 *   - everything else → straight to the network, never cached
 *
 * /api/, /admin/ and /_actions/ return early and always hit the network —
 * without that the navigation handler would shadow the back-office with a
 * cached public page.
 *
 * Bump CACHE to invalidate everything on the next activation.
 */

const CACHE_PREFIX = 'mk-breath-';
const CACHE = `${CACHE_PREFIX}v5`;
const APP_DOCUMENT = '/atemuebung/app';

// The app shell needed to launch the breathing exercise offline. The page's CSS
// is inlined into its HTML, so caching the document covers the styling; the
// island's JS chunks and fonts are filled in by the runtime asset handler below.
// This is not a complete first-install offline dependency precache.
const APP_SHELL = [
  APP_DOCUMENT,
  '/atemuebung.webmanifest',
  '/favicon.svg',
  '/favicon-192x192.png',
  '/favicon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Tolerate individual misses so one 404 can't abort the whole install.
      .then((cache) =>
        Promise.allSettled(
          APP_SHELL.map(async (url) => {
            const response = await fetch(url);
            if (isCacheable(response) && (url !== APP_DOCUMENT || isAppDocument(response))) {
              await cache.put(url, response);
            }
          }),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return /\.(?:woff2?|css|js|mjs|svg|png|jpe?g|webp|avif|ico|webmanifest)$/.test(url.pathname);
}

function isFingerprintedAsset(url) {
  // Verified Astro/Vite output: name.<8-char hash>[_image-transform].ext,
  // plus Astro Fonts' 16-character content hashes. A directory or extension
  // alone is not proof of immutability; public assets must keep revalidating.
  return (
    url.search === '' &&
    (/^\/(?:assets|_astro)\/[^/]+\.[\w-]{8}(?:_[\w-]+)?\.(?:css|js|mjs|svg|png|jpe?g|webp|avif|ico)$/.test(url.pathname) ||
      /^\/(?:assets|_astro)\/fonts\/[a-f0-9]{16}\.woff2?$/.test(url.pathname))
  );
}

function isCacheable(response) {
  return (
    response.status === 200 &&
    !response.redirected &&
    !/\b(?:no-store|private)\b/i.test(response.headers.get('cache-control') || '')
  );
}

function isAppDocument(response) {
  return isCacheable(response) && /^text\/html(?:;|$)/i.test(response.headers.get('content-type') || '');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // Dynamic back-office — never intercept. Letting these fall through to the
  // network keeps the JSON API, the admin UI and the server actions reachable;
  // otherwise the navigation handler below would serve a cached public page for
  // /admin/ instead of the live dashboard.
  if (
    url.pathname === '/api' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    url.pathname === '/_actions' ||
    url.pathname.startsWith('/_actions/')
  ) {
    return;
  }

  // Only the static app gets an offline document. All other navigations fall
  // through, even when an old worker once cached their scheduling HTML.
  if (request.mode === 'navigate') {
    if (url.pathname !== APP_DOCUMENT && url.pathname !== `${APP_DOCUMENT}/`) return;

    const network = fetch(request);
    event.waitUntil(
      network
        .then((response) => {
          if (isAppDocument(response)) {
            const copy = response.clone();
            return caches.open(CACHE).then((cache) => cache.put(APP_DOCUMENT, copy));
          }
        })
        .catch(() => { }),
    );
    event.respondWith(
      network.catch(() =>
        caches
          .open(CACHE)
          .then((cache) => cache.match(APP_DOCUMENT))
          .then((hit) => hit || Response.error()),
      ),
    );
    return;
  }

  // Do not fetch a fingerprinted cache hit at all. Mutable assets still
  // revalidate; waitUntil protects both the request and the eventual write.
  if (isStaticAsset(url)) {
    const cache = caches.open(CACHE);
    const hit = cache.then((store) => store.match(request));
    const network = hit.then((cached) => (cached && isFingerprintedAsset(url) ? undefined : fetch(request)));

    event.waitUntil(
      Promise.all([cache, network])
        .then(([store, response]) => {
          if (response && isCacheable(response)) return store.put(request, response.clone());
        })
        .catch(() => { }),
    );
    event.respondWith(hit.then((cached) => cached || network.then((response) => response || Response.error())));
  }
});
