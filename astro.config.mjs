// @ts-check

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import bun from '@igloczek/astro-bun-adapter';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders, memoryCache } from 'astro/config';
import icon from 'astro-icon';

const siteUrl = process.env.PUBLIC_SITE_URL || 'https://mens-circle.de';
const { hostname: siteHostname, protocol: siteProtocol } = new URL(siteUrl);

// Analytics only when both values are set (SeoHead.astro); its origin joins the CSP then.
const umamiOrigin =
  process.env.PUBLIC_UMAMI_ID && process.env.PUBLIC_UMAMI_ENDPOINT
    ? new URL(process.env.PUBLIC_UMAMI_ENDPOINT).origin
    : '';

const ATLAS = 'https://atlas.bayern.de';

/** Hashes of the head's inline scripts (src/scripts/inline.ts), exactly as rendered. */
/** @param {string} file */
const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
/** @param {string} code @returns {`sha256-${string}`} */
const sha256 = (code) => `sha256-${createHash('sha256').update(code).digest('base64')}`;

const inlineScriptHashes = [
  read('./src/scripts/boot.js'),
  read('./src/scripts/load-fonts.js'),
  JSON.stringify(JSON.parse(read('./src/scripts/speculation-rules.json'))),
].map(sha256);

export default defineConfig({
  site: siteUrl,
  // TLS ends at the proxy; this lets the CSRF check trust X-Forwarded-* for our host only.
  // Never disable checkOrigin instead.
  security: {
    allowedDomains: [{ hostname: siteHostname, protocol: siteProtocol.replace(':', '') }],
    // Astro's CSP: hashes of every script it bundles plus the head's inline scripts,
    // as a header on rendered pages and a <meta> on prerendered ones. Hashes, not
    // nonces: cached and prerendered HTML is reused.
    // server.ts adds what a <meta> cannot say (frame-ancestors) and the stricter
    // admin policy. Styles allow 'unsafe-inline': the BayernAtlas component renders
    // <style> elements into its shadow root, and markup sets custom properties inline.
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        `connect-src 'self'${umamiOrigin ? ` ${umamiOrigin}` : ''}`,
        `frame-src ${ATLAS}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: {
        resources: ["'self'", ATLAS, ...(umamiOrigin ? [umamiOrigin] : [])],
        hashes: inlineScriptHashes,
      },
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
    },
  },
  // Rendered public pages and the event JSON, held in this one process. Keyed by path
  // alone (none of them reads the query), so `?x=1` can neither bypass nor bloat it;
  // the LRU bound keeps a few dozen pages at most (~70 kB each).
  cache: {
    provider: memoryCache({ max: 64, query: { include: [] } }),
  },
  output: 'server',
  session: false,
  adapter: bun({ mode: 'standalone', bodySizeLimit: 1_048_576 }),
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
    // Cormorant for titles, quotes, dates and poster words (upright and italic: the
    // accent phrase of a title is set in italic); IBM Plex Sans for everything that
    // explains, mapped to font-display and font-sans in the shared theme. Latin
    // files in the repo (Cormorant variable ~35 and ~38 kB, Plex static ~23 kB each);
    // src/assets/fonts/README.md says where they come from.
    {
      name: 'Cormorant',
      // `optional`, with every file preloaded: a page is painted once and never
      // changes its faces afterwards. `swap` and `block` both re-laid the page out
      // when a font arrived after the first paint (the fallback breaks lines
      // differently), which read as a flicker. The price: a first visit on a slow
      // line may stay in the fallback until the next page.
      display: 'optional',
      cssVariable: '--font-cormorant',
      provider: fontProviders.local(),
      options: {
        variants: [
          { src: ['./src/assets/fonts/cormorant-variable-latin.woff2'], weight: '500 700', style: 'normal' },
          { src: ['./src/assets/fonts/cormorant-variable-latin-italic.woff2'], weight: '500 700', style: 'italic' },
        ],
      },
      fallbacks: ['Georgia', 'Times New Roman', 'serif'],
    },
    {
      name: 'IBM Plex Sans',
      // `optional`, with every file preloaded: a page is painted once and never
      // changes its faces afterwards. `swap` and `block` both re-laid the page out
      // when a font arrived after the first paint (the fallback breaks lines
      // differently), which read as a flicker. The price: a first visit on a slow
      // line may stay in the fallback until the next page.
      display: 'optional',
      cssVariable: '--font-plex',
      provider: fontProviders.local(),
      options: {
        // Two static cuts instead of the variable file (46 kB): the regular carries
        // 400–500, the semibold 600–700. All four files of a page are preloaded: a late
        // swap of the italic phrase or of a button label would shift the layout.
        variants: [
          { src: ['./src/assets/fonts/ibm-plex-sans-400-latin.woff2'], weight: '400 500', style: 'normal' },
          { src: ['./src/assets/fonts/ibm-plex-sans-600-latin.woff2'], weight: '600 700', style: 'normal' },
        ],
      },
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
      // The back office, the sign-in, the styleguide and the brand templates stay out.
      filter: (page) => !['/admin', '/auth', '/styleguide', '/brand'].some((p) => page.includes(p)),
      // Slash-less, matching the canonicals.
      serialize(item) {
        const url = new URL(item.url);

        if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');

        return { ...item, url: url.href };
      },
    }),
  ],
});
