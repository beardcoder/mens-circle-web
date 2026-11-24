// @ts-check

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import bun from '@igloczek/astro-bun-adapter';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders, memoryCache, sessionDrivers } from 'astro/config';
import icon from 'astro-icon';
import emdash from 'emdash/astro';
import { sqlite } from 'emdash/db';

import { mensCircle } from './src/plugin/index.ts';

const siteUrl = process.env.PUBLIC_SITE_URL || 'https://mens-circle.de';
const { hostname: siteHostname, protocol: siteProtocol } = new URL(siteUrl);

// Analytics only when both values are set (SeoHead.astro); its origin joins the CSP then.
const umamiOrigin =
  process.env.PUBLIC_UMAMI_ID && process.env.PUBLIC_UMAMI_ENDPOINT
    ? new URL(process.env.PUBLIC_UMAMI_ENDPOINT).origin
    : '';

const ATLAS = 'https://atlas.bayern.de';

// EmDash bakes the database location into the build: set DATABASE_PATH where `astro build` runs.
const databasePath = process.env.DATABASE_PATH || './data/emdash.db';

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
  // EmDash keeps the signed-in admin in Astro's session: files beside the database.
  session: { driver: sessionDrivers.fsLite({ base: join(dirname(databasePath), 'sessions') }) },
  adapter: bun({ mode: 'standalone', bodySizeLimit: 1_048_576 }),
  vite: {
    // Tailwind v4: the theme lives in src/styles/theme.css (CSS-first).
    plugins: [tailwindcss()],
    // Bundle everything for the build only; in dev, CommonJS deps break Vite's module runner.
    // Sharp stays external: it only runs at build time (the server answers /_image with 404).
    ssr: { noExternal: process.argv.includes('build') || undefined, external: ['sharp'] },
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
    // The CMS took over the back office.
    '/admin': '/_emdash/admin',
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
    // accent phrase of a title is set in italic); Geist for everything that
    // explains, mapped to font-display and font-sans in the shared theme. Latin
    // files in the repo (Cormorant variable ~35 and ~38 kB, Geist static ~13 kB each);
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
      name: 'Geist',
      // `optional`, with every file preloaded: a page is painted once and never
      // changes its faces afterwards. `swap` and `block` both re-laid the page out
      // when a font arrived after the first paint (the fallback breaks lines
      // differently), which read as a flicker. The price: a first visit on a slow
      // line may stay in the fallback until the next page.
      display: 'optional',
      cssVariable: '--font-geist',
      provider: fontProviders.local(),
      options: {
        // Two static cuts instead of the variable file (29 kB): the regular carries
        // 400–500, the semibold 600–700. All four files of a page are preloaded: a late
        // swap of the italic phrase or of a button label would shift the layout.
        variants: [
          { src: ['./src/assets/fonts/geist-400-latin.woff2'], weight: '400 500', style: 'normal' },
          { src: ['./src/assets/fonts/geist-600-latin.woff2'], weight: '600 700', style: 'normal' },
        ],
      },
      fallbacks: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
    },
  ],
  integrations: [
    react(),
    // The CMS: admin at /_emdash/admin (passkeys), events, registrations and voices as
    // collections (seed/seed.json), the registration logic and its mails in the plugin.
    emdash({
      database: sqlite({ url: `file:${databasePath}` }),
      siteUrl,
      plugins: [mensCircle()],
      admin: {
        siteName: 'Männerkreis',
        favicon: '/favicon.svg',
        locales: ['de'],
        hiddenNavItems: ['comments', 'menus', 'redirects', 'widgets', 'sections', 'bylines', 'import'],
      },
    }),
    icon(),
    sitemap({
      // These public entry pages now render current data on demand.
      customPages: [new URL('/', siteUrl).href, new URL('/event', siteUrl).href],
      // The event pages are SSR; EmDash serves their sitemap (`/sitemap-[collection].xml`).
      customSitemaps: [new URL('/sitemap-events.xml', siteUrl).href],
      // Every public page is indexed; the CMS stays out.
      filter: (page) => !page.includes('/_emdash'),
      // Slash-less, matching the canonicals.
      serialize(item) {
        const url = new URL(item.url);

        if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');

        return { ...item, url: url.href };
      },
    }),
  ],
});
