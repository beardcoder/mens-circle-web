// @ts-check

import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import bun from '@wyattjoh/astro-bun-adapter';
import umami from '@yeskunall/astro-umami';
import icon from 'astro-icon';
import llms, { DEFAULT_NOISE_SELECTORS } from 'astro-llms-md';
import { defineConfig, fontProviders } from 'astro/config';
import { addSitemapsToIndex } from './astro-integrations/sitemap-index-extra.mjs';
import { serveLlmsWithBunAdapter, serveSitemapWithBunAdapter } from './astro-integrations/serve-with-bun-adapter.mjs';
import { UMAMI_ENDPOINT, UMAMI_WEBSITE_ID } from './src/lib/umami-config.ts';

// SSR on Bun: the adapter builds dist/server/entry.mjs, and that single process
// is the public edge — static assets, prerendered HTML and on-demand routes.
// Only the event pages and the home testimonials render per request.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://mens-circle.de',
  output: 'server',
  adapter: bun({ isr: true }),
  // `session: false` is deliberately absent: adapter 2.1.1 overwrites it with an
  // fs-lite driver, so the opt-out is a no-op. Set it once the adapter honours it.
  // `bun:sqlite` is a Bun builtin — external, or Rollup tries to bundle it.
  vite: {
    ssr: { external: ['bun:sqlite'] },
    optimizeDeps: { exclude: ['bun:sqlite'] },
    // Lightning CSS autoprefixes from real compat data (so `-webkit-backdrop-filter`
    // is handled for us). `cssTarget` stays modern so the tokens' `oklch()` and
    // `color-mix()` survive minification instead of being downleveled.
    css: {
      transformer: 'lightningcss',
    },
    build: {
      cssMinify: 'lightningcss',
      cssTarget: ['chrome111', 'edge111', 'firefox113', 'safari16.4'],
    },
  },
  trailingSlash: 'ignore',
  redirects: {
    '/home': '/',
    '/events': '/event',
    // Legacy plural deep-links → the per-event page (was a PocketBase route).
    '/events/[slug]': '/event/[slug]',
    // Old PocketBase page, still indexed.
    '/ueber-uns': '/#ueber',
    // Interim URL from before @astrojs/sitemap.
    '/sitemap.xml': '/sitemap-index.xml',
  },
  // Prefetch in-viewport internal links; pairs with the cross-document view
  // transitions in styles/utilities/_view-transitions.css.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  experimental: {
    // Speculation Rules where supported: the next page is rendered off-screen
    // before the click, so the view transition starts from a ready frame.
    clientPrerender: true,
  },
  build: {
    // Keep asset URLs stable and cache-friendly.
    assets: 'assets',
    // Inline the CSS rather than link it: the external stylesheet cost a
    // render-blocking second round-trip (~400ms). Compression absorbs the
    // repetition per document.
    inlineStylesheets: 'always',
  },
  // Native Astro Fonts API: self-hosted, subset woff2 with inline @font-face and
  // auto-derived metric-matched fallbacks, so the swap shifts nothing. The <Font>
  // components in src/layouts/Layout.astro wire up the variables and preloads.
  //
  // One superfamily, two cuts. Barlow Condensed 800 is the poster voice — the
  // hero, the statement, the step numerals — and Barlow sets everything that has
  // to be read. Same skeleton, so the page holds together while the two sit at
  // wildly different sizes; both OFL-1.1 and served from our own origin.
  //
  // The admin shares them. It used to carry two families of its own (Bricolage
  // Grotesque and IBM Plex Mono) for a separate back-office identity; that
  // identity is gone, and so are the two extra webfonts.
  fonts: [
    {
      // Display. Loaded in two weights only: 800 does the shouting, 600 the
      // small condensed labels (kickers, meta, nav).
      name: 'Barlow Condensed',
      cssVariable: '--font-condensed',
      provider: fontProviders.fontsource(),
      weights: ['600', '800'],
      styles: ['normal'],
      subsets: ['latin'], // covers German äöüß
      fallbacks: ['Oswald', 'Arial Narrow', 'system-ui', 'sans-serif'],
    },
    {
      // Running text, forms, buttons.
      name: 'Barlow',
      cssVariable: '--font-text',
      provider: fontProviders.fontsource(),
      weights: ['400', '600'],
      styles: ['normal', 'italic'],
      subsets: ['latin'],
      fallbacks: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
    },
  ],
  integrations: [
    svelte(),
    // Local SVGs from src/icons/, inlined via <Icon name="…" />.
    icon(),
    sitemap({
      // Drop noindex / non-public routes. Event pages are SSR and unknown at build
      // time; /sitemap-events.xml lists those, wired in by addSitemapsToIndex below.
      filter: (page) =>
        !page.includes('/admin') &&
        !page.includes('/impressum') &&
        !page.includes('/datenschutz') &&
        !page.includes('/atemuebung/app'),
      // Slash-less URLs, matching the canonicals — every entry resolves 200
      // instead of 301-redirecting.
      serialize(item) {
        const url = new URL(item.url);
        if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
        return { ...item, url: url.href };
      },
    }),
    // Must sit BETWEEN sitemap() and serveSitemapWithBunAdapter(): it needs the
    // index to exist, and must patch it before the manifest records its length.
    addSitemapsToIndex({ paths: ['/sitemap-events.xml'] }),
    // Must run AFTER sitemap(): registers its output in the adapter's manifest.
    serveSitemapWithBunAdapter(),
    // llms.txt for AI crawlers, derived from the built HTML so it cannot drift.
    // Pinned to 2.x on purpose: v3 dropped both `DEFAULT_NOISE_SELECTORS` and the
    // `excludeSelectors` option (the config no longer loads), and its new SSR pass
    // ignores `exclude` — it scrapes /admin/* from the *live* site at build time and
    // publishes it as .md. Revisit once `exclude` covers SSR routes again.
    llms({
      name: 'Männerkreis Niederbayern/ Straubing',
      description:
        'Ein Männerkreis in Straubing / Niederbayern – ein geschützter Raum für echte Begegnung, authentischen Austausch und persönliches Wachstum unter Männern. Die Treffen finden regelmäßig statt und laufen auf Spendenbasis. Es ist keine Vorerfahrung nötig.',
      contentSelector: 'main',
      // Strip chrome (nav/footer/forms/aria-hidden) so the markdown is prose.
      excludeSelectors: [...DEFAULT_NOISE_SELECTORS],
      // Back-office and the noindex breathing app stay out of the AI index.
      exclude: ['admin/**', 'atemuebung/app/**'],
    }),
    // Must run AFTER llms(), same manifest reason as serveSitemapWithBunAdapter.
    serveLlmsWithBunAdapter(),
    // Umami tracker. Id + endpoint from src/lib/umami-config.ts, shared with the
    // layout's heatmap recorder and SeoHead's preconnect. `performance` turns on
    // Umami's own Core Web Vitals collection.
    umami({
      id: UMAMI_WEBSITE_ID,
      performance: true,
      endpointUrl: UMAMI_ENDPOINT,
    }),
  ],
});
