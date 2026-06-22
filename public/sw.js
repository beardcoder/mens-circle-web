/**
 * Service worker for the installable breathing app (Atemübung).
 *
 * Scope is the whole origin (the file is served from the root), but the
 * strategy is deliberately conservative so the SSR site stays fresh:
 *
 *   - navigations      → network-first, falling back to cache when offline,
 *                        then to the cached breathing app shell as a last resort
 *   - static, hashed   → stale-while-revalidate (immutable build assets, fonts,
 *     assets              images, icons)
 *   - everything else  → straight to the network (never cached: the JSON API,
 *                        admin UI, server actions, POST/PUT, cross-origin, etc.)
 *
 * The dynamic back-office is never intercepted — the SW returns early for the
 * API (/api/), the admin UI (/admin/) and the server actions (/_actions/) so
 * those always hit the network. Without that, the whole-origin navigation
 * handler would shadow /admin/ and serve a cached public page instead.
 *
 * Bump CACHE to invalidate everything on the next activation.
 */

const CACHE = 'mk-breath-v3';

// The app shell needed to launch the breathing exercise offline. The page's CSS
// is inlined into its HTML, so caching the document covers the styling; the
// island's JS chunks and fonts are filled in by the runtime SWR handler below.
const APP_SHELL = [
  '/atemuebung/app',
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
        Promise.allSettled(APP_SHELL.map((url) => cache.add(url))),
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
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    /\/(?:_astro|assets)\//.test(url.pathname) ||
    /\.(?:woff2?|css|js|mjs|svg|png|jpe?g|webp|avif|ico)$/.test(url.pathname)
  );
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
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/_actions/')
  ) {
    return;
  }

  // Navigations: always prefer the live (SSR) response; cache it for offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit || caches.match('/atemuebung/app')),
        ),
    );
    return;
  }

  // Immutable build assets: serve from cache, refresh in the background.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then((hit) => {
          const network = fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => hit);

          return hit || network;
        }),
      ),
    );
  }
});
