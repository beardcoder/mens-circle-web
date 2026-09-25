// @ts-check

import sitemap from '@astrojs/sitemap';
import bun, { bunImageService } from '@mens-circle/astro-bun';
import icon from 'astro-icon';
import llms from 'astro-llms-md';
import { defineConfig, fontProviders } from 'astro/config';
import { publishGeneratedFiles } from './astro-integrations/publish-generated-files.mjs';
import { cacheControlForFile } from './src/lib/cache-policy.ts';
import site from './src/data/site.json' with { type: 'json' };

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
  image: {
    // Bun.Image instead of Sharp; needs the build to run on Bun (`bun --bun astro build`).
    service: bunImageService(),
    // Replaces Astro's runtime transformer with a 404.
    endpoint: { entrypoint: './src/lib/disabled-image-endpoint.ts', route: '/_image' },
  },
  vite: {
    // Bundle everything for the build only; in dev, CommonJS deps break Vite's module runner.
    ssr: { noExternal: process.argv.includes('build') || undefined, external: ['bun:sqlite'] },
    optimizeDeps: { exclude: ['bun:sqlite'] },
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
    // Redirects to `/` live in src/middleware.ts (Astro emits nothing for them here).
    '/events/[slug]': '/event/[slug]',
    '/ueber-uns': '/#ueber',
    '/sitemap.xml': '/sitemap-index.xml',
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  build: {
    assets: 'assets',
    inlineStylesheets: 'always',
  },
  fonts: [
    {
      name: 'Barlow Condensed',
      cssVariable: '--font-condensed',
      provider: fontProviders.fontsource(),
      weights: ['600', '800'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['Oswald', 'Arial Narrow', 'system-ui', 'sans-serif'],
    },
    {
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
    icon(),
    sitemap({
      filter: (page) => !page.includes('/admin') && !page.includes('/impressum') && !page.includes('/datenschutz'),
      // Slash-less, matching the canonicals.
      serialize(item) {
        const url = new URL(item.url);
        if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
        return { ...item, url: url.href };
      },
    }),
    llms({
      name: site.siteName,
      description: site.description,
      contentSelector: 'main',
      // The first six are v3's DEFAULT_NOISE_SELECTORS, which 3.0.2 does not export.
      excludeSelectors: [
        'nav',
        'aside',
        'footer',
        'form',
        "[aria-hidden='true']",
        '[hidden]',
        '.home-live-event',
        '.testimonials-section',
      ],
      // event/health: v3 would fetch these SSR routes from the live site at build time.
      exclude: ['admin/**', 'impressum/**', 'datenschutz/**', 'event', 'health'],
    }),
    // After sitemap() and llms(), whose output it patches.
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
