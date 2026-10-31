// @ts-check

import node from '@astrojs/node';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders, memoryCache } from 'astro/config';
import icon from 'astro-icon';

const siteUrl = process.env.PUBLIC_SITE_URL || 'https://mens-circle.de';
const { hostname: siteHostname, protocol: siteProtocol } = new URL(siteUrl);

export default defineConfig({
  site: siteUrl,
  // TLS ends at the proxy; this lets the CSRF check trust X-Forwarded-* for our host only.
  // Never disable checkOrigin instead.
  security: {
    allowedDomains: [{ hostname: siteHostname, protocol: siteProtocol.replace(':', '') }],
  },
  // Rendered public pages and the event JSON, held in this one process. Keyed by path
  // alone (none of them reads the query), so `?x=1` can neither bypass nor bloat it;
  // the LRU bound keeps a few dozen pages at most (~70 kB each).
  cache: {
    provider: memoryCache({ max: 64, query: { include: [] } }),
  },
  output: 'server',
  session: false,
  adapter: node({ mode: 'standalone', bodySizeLimit: 1_048_576 }),
  vite: {
    // Tailwind v4: the theme lives in src/styles/theme.css (CSS-first).
    plugins: [tailwindcss()],
    // Bundle everything for the build only; in dev, CommonJS deps break Vite's module runner.
    // Sharp stays external: it only runs at build time (the server answers /_image with 404).
    ssr: { noExternal: process.argv.includes('build') || undefined, external: ['bun:sqlite', 'sharp'] },
    optimizeDeps: { exclude: ['bun:sqlite'] },
    css: {
      transformer: 'lightningcss',
    },
    build: {
      cssMinify: 'lightningcss',
      cssTarget: ['chrome111', 'edge111', 'firefox113', 'safari16.4'],
    },
  },
  // Astro 301s `/a/` to `/a`; the adapter leaves that form of a static page to it.
  trailingSlash: 'never',
  // Retired URLs. Unknown paths never reach the middleware (they render the 404 page).
  redirects: {
    '/events': '/event',
    '/events/[slug]': '/event/[slug]',
    '/ueber-uns': '/#ueber',
    '/sitemap.xml': '/sitemap-index.xml',
    // The breathing exercise and its app are gone; the home page is the closest.
    '/home': '/',
    '/atemuebung': '/',
    '/atemuebung/app': '/',
  },
  build: {
    assets: 'assets',
    inlineStylesheets: 'auto',
  },
  fonts: [
    // Fraunces for titles, quotes and dates; Figtree for everything that explains,
    // mapped to font-display and font-sans in the shared theme. Titles only ever set
    // Fraunces 500, so one static face (~18 kB) does; Figtree is one variable file
    // (~20 kB) for 400–700.
    {
      name: 'Fraunces',
      cssVariable: '--font-fraunces',
      provider: fontProviders.fontsource(),
      weights: [500],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['Georgia', 'Times New Roman', 'serif'],
    },
    {
      name: 'Figtree',
      cssVariable: '--font-figtree',
      provider: fontProviders.fontsource(),
      weights: ['300 900'],
      styles: ['normal', 'italic'],
      subsets: ['latin'],
      fallbacks: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
    },
  ],
  integrations: [
    preact(),
    icon(),
    sitemap({
      // These public entry pages now render current data on demand.
      customPages: [new URL('/', siteUrl).href, new URL('/event', siteUrl).href],
      // The event pages are SSR; their sitemap is a route, listed in the index here.
      customSitemaps: [new URL('/sitemap-events.xml', siteUrl).href],
      // Every public page is indexed; only the back office and sign-in stay out.
      filter: (page) => !['/admin', '/auth'].some((p) => page.includes(p)),
      // Slash-less, matching the canonicals.
      serialize(item) {
        const url = new URL(item.url);

        if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');

        return { ...item, url: url.href };
      },
    }),
  ],
});
