// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';
import umami from '@yeskunall/astro-umami';

// Umami analytics is opt-in: it only loads when a website id is configured.
// Self-hosted instances set PUBLIC_UMAMI_ENDPOINT (e.g. https://umami.example.com).
const umamiId = process.env.PUBLIC_UMAMI_ID;
const umamiEndpoint = process.env.PUBLIC_UMAMI_ENDPOINT;
const analytics = umamiId
  ? [
      umami({
        id: umamiId,
        ...(umamiEndpoint ? { endpointUrl: umamiEndpoint } : {}),
      }),
    ]
  : [];

// Static site. The build output (./dist) is served as static files by
// PocketBase (pb_public) in production — a single, tiny Go process serves
// the whole frontend plus the API/admin/email backend.
// https://astro.build/config
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://mens-circle.de',
  output: 'static',
  trailingSlash: 'ignore',
  redirects: {
    '/home': '/',
    '/events': '/event',
  },
  // Prefetch in-viewport internal links for instant navigation. Pairs with the
  // CSS cross-document view transitions (styles/utilities/_view-transitions.css).
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  build: {
    // Keep asset URLs stable and cache-friendly.
    assets: 'assets',
    // Inline the bundled CSS into each page's <head> instead of emitting a
    // separate <link rel="stylesheet">. The external stylesheet was a
    // render-blocking second request (~400ms: HTML must arrive and be parsed
    // before the browser even discovers the link). Inlining ships the CSS with
    // the HTML in one request, so first paint no longer waits on a round-trip.
    // Pages are gzip/brotli-compressed on the wire and prefetched, which
    // absorbs the cost of repeating the CSS per document.
    inlineStylesheets: 'always',
  },
  integrations: [
    svelte(),
    sitemap({
      filter: (page) =>
        // Legal pages are noindex; keep them out of the sitemap.
        !page.includes('/impressum') && !page.includes('/datenschutz'),
    }),
    ...analytics,
  ],
  vite: {},
});
