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
  cache: {
    provider: memoryCache(),
  },
  output: 'server',
  session: false,
  adapter: node({ mode: 'standalone', bodySizeLimit: 1_048_576 }),
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
  // Prefetch only explicitly marked links; private admin pages use native navigation.
  prefetch: { prefetchAll: false },
  build: {
    assets: 'assets',
    inlineStylesheets: 'auto',
  },
  fonts: [
    // Playfair Display for headings and quotes; DM Sans for prose, UI and labels.
    // Both variable, mapped to font-serif and font-sans in the shared theme.
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
      // These public entry pages now render current data on demand.
      customPages: [new URL('/', siteUrl).href, new URL('/event', siteUrl).href],
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
