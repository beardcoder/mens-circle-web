// @ts-check

import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import bun from '@mens-circle/astro-bun';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';
import icon from 'astro-icon';

import { cacheControlForFile } from './src/lib/cache-policy.ts';

const siteUrl = process.env.PUBLIC_SITE_URL || 'https://mens-circle.de';
const { hostname: siteHostname, protocol: siteProtocol } = new URL(siteUrl);

export default defineConfig({
  site: siteUrl,
  // TLS ends at the proxy; this lets the CSRF check trust X-Forwarded-* for our host only.
  // Never disable checkOrigin instead.
  security: {
    allowedDomains: [{ hostname: siteHostname, protocol: siteProtocol.replace(':', '') }],
  },
  output: 'server',
  adapter: bun({
    // The cache policy for files on disk; HTML keeps what the page set at prerender time.
    staticHeaders: (pathname, { assets }) => {
      const cacheControl = cacheControlForFile(pathname, assets);

      return cacheControl ? { 'cache-control': cacheControl } : null;
    },
  }),
  vite: {
    // Tailwind v4: the theme lives in src/styles/theme.css (CSS-first).
    plugins: [tailwindcss()],
    // Bundle everything for the build only; in dev, CommonJS deps break Vite's module runner.
    // Sharp stays external: its native binding resolves from node_modules, not from the bundle.
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
  redirects: {
    '/events': '/event',
    // Redirects to `/` live in src/middleware.ts (Astro emits nothing for them here).
    '/events/[slug]': '/event/[slug]',
    '/ueber-uns': '/#ueber',
    '/sitemap.xml': '/sitemap-index.xml',
  },
  // Only links marked `data-astro-prefetch`; the admin's <ClientRouter /> would otherwise prefetch all.
  prefetch: { prefetchAll: false },
  build: {
    assets: 'assets',
    inlineStylesheets: 'always',
  },
  fonts: [
    // Playfair Display speaks: titles at its regular weight, tracked in, with
    // the italic as the accent; quotes in the italic. DM Sans explains: text,
    // UI, labels. Both variable. Tailwind maps them to `font-serif` and
    // `font-sans`; the admin uses the same two.
    {
      name: 'Playfair Display',
      cssVariable: '--font-playfair',
      provider: fontProviders.fontsource(),
      weights: ['400 900'],
      styles: ['normal', 'italic'],
      subsets: ['latin'],
      fallbacks: ['Georgia', 'Times New Roman', 'serif'],
    },
    {
      name: 'DM Sans',
      cssVariable: '--font-dm-sans',
      provider: fontProviders.fontsource(),
      weights: ['100 1000'],
      styles: ['normal', 'italic'],
      subsets: ['latin'],
      fallbacks: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
    },
  ],
  integrations: [
    preact(),
    icon(),
    sitemap({
      // The event pages are SSR; their sitemap is a route, listed in the index here.
      customSitemaps: [new URL('/sitemap-events.xml', siteUrl).href],
      // The testimonial form is for people who were there, not for search (noindex too).
      filter: (page) =>
        !['/admin', '/impressum', '/datenschutz', '/teile-deine-erfahrung', '/auth'].some((p) => page.includes(p)),
      // Slash-less, matching the canonicals.
      serialize(item) {
        const url = new URL(item.url);

        if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');

        return { ...item, url: url.href };
      },
    }),
  ],
});
