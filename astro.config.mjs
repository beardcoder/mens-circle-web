// @ts-check

import sitemap from '@astrojs/sitemap';
import bun from '@wyattjoh/astro-bun-adapter';
import icon from 'astro-icon';
import llms, { DEFAULT_NOISE_SELECTORS } from 'astro-llms-md';
import { defineConfig, fontProviders } from 'astro/config';
import { publishGeneratedFiles } from './astro-integrations/publish-generated-files.mjs';
import site from './src/data/site.json' with { type: 'json' };

const siteUrl = process.env.PUBLIC_SITE_URL || 'https://mens-circle.de';
// Protocol without the trailing colon — the shape `allowedDomains` matches on.
const { hostname: siteHostname, protocol: siteProtocol } = new URL(siteUrl);

// SSR on Bun: the adapter builds dist/server/entry.mjs, and that single process
// is the public edge — static assets, prerendered HTML and on-demand routes.
// Event pages and home server islands render per request; photos are prerendered.
export default defineConfig({
  site: siteUrl,
  // TLS terminates at the Coolify/Traefik proxy, so the Bun process receives
  // plain HTTP and `Astro.url` reads `http://<host>`. The browser's `Origin` on
  // a form POST says `https://<host>`, so Astro's CSRF check (`checkOrigin`,
  // on by default) saw two different origins and answered every Anmeldung with
  // 403 "Cross-site POST form submissions are forbidden".
  //
  // `allowedDomains` is the supported fix: it is the ONLY thing that makes
  // Astro trust `X-Forwarded-Proto`/`X-Forwarded-Host` at all, and it must name
  // the domain explicitly — an unlisted host header is ignored, which is what
  // keeps host-header injection out. Do not "fix" a future 403 by turning
  // `checkOrigin` off; that removes the CSRF protection from every action.
  security: {
    allowedDomains: [{ hostname: siteHostname, protocol: siteProtocol.replace(':', '') }],
  },
  output: 'server',
  adapter: bun({ isr: false }),
  image: {
    // Astro always registers this SSR route. Removing the override would
    // restore its runtime transformer; this handler only returns 404.
    endpoint: { entrypoint: './src/lib/disabled-image-endpoint.ts', route: '/_image' },
  },
  // `session: false` is deliberately absent: adapter 2.1.1 overwrites it with an
  // fs-lite driver, so the opt-out is a no-op. Set it once the adapter honours it.
  // `bun:sqlite` is a Bun builtin — external, or Rollup tries to bundle it.
  vite: {
    // The production server is one self-contained bundle (the runtime image
    // ships no node_modules). Only for the build, though: in dev, bundling every
    // dependency sends CommonJS packages (picomatch) through Vite's module
    // runner, which dies on `require`. Sharp is used by the prerender build but
    // never bundled into the server (and is not installed in the runtime image).
    ssr: { noExternal: process.argv.includes('build') || undefined, external: ['bun:sqlite', 'sharp'] },
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
    '/events': '/event',
    // Redirects to `/` itself live in src/middleware.ts: Astro emits nothing
    // for them here, so they answered 404.
    // Legacy plural deep-links → the per-event page (was a PocketBase route).
    '/events/[slug]': '/event/[slug]',
    // Old PocketBase page, still indexed.
    '/ueber-uns': '/#ueber',
    // Interim URL from before @astrojs/sitemap.
    '/sitemap.xml': '/sitemap-index.xml',
  },
  // Only explicitly marked static links prefetch on intent. Live scheduling
  // and admin must not render/execute speculatively.
  // Native cross-document view transitions do not require prerendering.
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
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
    // Local SVGs from src/icons/, inlined via <Icon name="…" />.
    icon(),
    sitemap({
      // Drop noindex / non-public routes. Event pages are SSR and unknown at build
      // time; /sitemap-events.xml lists those, wired in by publishGeneratedFiles.
      filter: (page) => !page.includes('/admin') && !page.includes('/impressum') && !page.includes('/datenschutz'),
      // Slash-less URLs, matching the canonicals — every entry resolves 200
      // instead of 301-redirecting.
      serialize(item) {
        const url = new URL(item.url);
        if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
        return { ...item, url: url.href };
      },
    }),
    // llms.txt for AI crawlers, derived from the built HTML so it cannot drift.
    // Pinned to 2.x on purpose: v3 dropped both `DEFAULT_NOISE_SELECTORS` and the
    // `excludeSelectors` option (the config no longer loads), and its new SSR pass
    // ignores `exclude` — it scrapes /admin/* from the *live* site at build time and
    // publishes it as .md. Revisit once `exclude` covers SSR routes again.
    llms({
      name: site.siteName,
      description: site.description,
      contentSelector: 'main',
      // Strip chrome (nav/footer/forms/aria-hidden) so the markdown is prose.
      excludeSelectors: [...DEFAULT_NOISE_SELECTORS, '.home-live-event', '.testimonials-section'],
      // Back-office stays out of the AI index — and so do the legal pages. They are noindex for search for the same reason
      // they are noise here: llms-full.txt was 19KB of which the privacy policy
      // was the larger half, so a model reading it learned our data-retention
      // periods and not what the Männerkreis is. Same exclusion list as the
      // sitemap, for the same reason.
      exclude: ['admin/**', 'impressum/**', 'datenschutz/**'],
    }),
    // Must run AFTER sitemap() and llms(): patches and publishes their output.
    publishGeneratedFiles({
      sitemaps: ['/sitemap-events.xml'],
      llmsPages: [
        {
          path: '/event',
          title: 'Termine & Anmeldung',
          description:
            'Wann der nächste Männerkreis stattfindet, wo er stattfindet, wie lange er dauert, was er kostet und wie du dich anmeldest.',
        },
      ],
    }),
  ],
});
