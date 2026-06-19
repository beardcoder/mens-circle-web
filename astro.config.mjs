// @ts-check

import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import umami from '@yeskunall/astro-umami';
import { defineConfig, fontProviders, logHandlers } from 'astro/config';
import bun from './adapter/index.mjs';

// Structured logging (Astro 7). When LOG_FORMAT=json, bake a JSON log handler
// into the SSR manifest so the Bun runtime emits one compact JSON object per log
// line — SSR errors included — ready for Coolify/log aggregation. The config
// runs at BUILD time and the runtime replays the baked handler, so the
// production Dockerfile sets LOG_FORMAT=json in its build stage; local dev and
// CI leave it unset and keep Astro's human-readable console output.
const jsonLogger = process.env.LOG_FORMAT === 'json' ? { logger: logHandlers.json() } : {};

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

// SSR on the Bun runtime. The local "mens-circle-edge" adapter (adapter/) builds
// its own server entry (adapter/server.mjs → dist/server/entry.mjs) which Bun
// runs: it serves static + SSR AND reverse-proxies the dynamic PocketBase paths
// — so a single Bun process is the public edge (no nginx) and PocketBase stays
// on loopback for the API/admin/email backend. Most pages are prerendered
// (static, RAM-friendly); only the event pages and the home testimonials render
// on demand from PocketBase.
// https://astro.build/config
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://mens-circle.de',
  output: 'server',
  adapter: bun(),
  ...jsonLogger,
  trailingSlash: 'ignore',
  redirects: {
    '/home': '/',
    '/events': '/event',
    // Legacy plural deep-links → the per-event page (was a PocketBase route).
    '/events/[slug]': '/event/[slug]',
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
  // Native Astro Fonts API (stable since Astro 6). Replaces the former
  // `@fontsource-variable/*` CSS @imports + the hand-maintained fallback faces
  // in styles/base/_fonts.css. Astro self-hosts and subsets the woff2, emits
  // the @font-face rules inline (no render-blocking @import), and auto-derives
  // metric-matched fallback faces (`optimizedFallbacks`, on by default) from the
  // trailing generic family — so the first paint is dimensionally stable and the
  // eventual swap shifts nothing. The <Font> component in the layout head wires
  // up the CSS variables and the preloads (see src/layouts/Layout.astro).
  fonts: [
    {
      // Display / headings — the hero heading (incl. its big italic accent) is
      // the LCP, so this family is preloaded.
      name: 'Playfair Display',
      cssVariable: '--font-playfair',
      provider: fontProviders.fontsource(),
      weights: ['400 900'], // variable range
      styles: ['normal', 'italic'],
      subsets: ['latin'], // covers German äöüß
      fallbacks: ['Georgia', 'serif'],
    },
    {
      // Body / UI text.
      name: 'DM Sans',
      cssVariable: '--font-dm-sans',
      provider: fontProviders.fontsource(),
      weights: ['100 1000'], // variable range
      styles: ['normal', 'italic'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
  integrations: [
    svelte(),
    sitemap({
      filter: (page) =>
        // Legal pages are noindex; keep them out of the sitemap.
        !page.includes('/impressum') && !page.includes('/datenschutz'),
    }),
    ...analytics,
  ],
});
