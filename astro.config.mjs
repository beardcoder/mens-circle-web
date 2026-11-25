import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import bun from '@igloczek/astro-bun-adapter'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, fontProviders, memoryCache, sessionDrivers } from 'astro/config'
import icon from 'astro-icon'
import emdash from 'emdash/astro'
import { sqlite } from 'emdash/db'

import { mensCircle } from './src/plugin/index.ts'

const siteUrl = process.env.PUBLIC_SITE_URL || 'https://mens-circle.de'
const { hostname: siteHostname, protocol: siteProtocol } = new URL(siteUrl)

const umamiOrigin
  = process.env.PUBLIC_UMAMI_ID && process.env.PUBLIC_UMAMI_ENDPOINT
    ? new URL(process.env.PUBLIC_UMAMI_ENDPOINT).origin
    : ''

const ATLAS = 'https://atlas.bayern.de'

const databasePath = process.env.DATABASE_PATH || './data/emdash.db'

/** Hashes of the head's inline scripts (src/scripts/inline.ts), exactly as rendered. */
/** @param {string} file */
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8')
/** @param {string} code @returns {`sha256-${string}`} */
const sha256 = code => `sha256-${createHash('sha256').update(code).digest('base64')}`

const inlineScriptHashes = [
  read('./src/scripts/boot.js'),
  read('./src/scripts/load-fonts.js'),
  JSON.stringify(JSON.parse(read('./src/scripts/speculation-rules.json'))),
].map(sha256)

export default defineConfig({
  site: siteUrl,

  security: {
    allowedDomains: [
      {
        hostname: siteHostname,
        protocol: siteProtocol.replace(':', ''),
      },
    ],
    csp: {
      directives: [
        'default-src \'self\'',
        'img-src \'self\' data:',
        'font-src \'self\'',
        `connect-src 'self'${umamiOrigin ? ` ${umamiOrigin}` : ''}`,
        `frame-src ${ATLAS}`,
        'object-src \'none\'',
        'base-uri \'self\'',
        'form-action \'self\'',
      ],
      scriptDirective: {
        resources: ['\'self\'', ATLAS, ...(umamiOrigin ? [umamiOrigin] : [])],
        hashes: inlineScriptHashes,
      },
      styleDirective: { resources: ['\'self\'', '\'unsafe-inline\''] },
    },
  },
  cache: {
    provider: memoryCache({ max: 64, query: { include: [] } }),
  },
  output: 'server',
  session: {
    driver: sessionDrivers.fsLite(
      {
        base: join(dirname(databasePath), 'sessions'),
      },
    ),
  },
  adapter: bun({ mode: 'standalone', bodySizeLimit: 1_048_576 }),
  vite: {
    plugins: [tailwindcss()],
    ssr: { noExternal: process.argv.includes('build') || undefined, external: ['sharp'] },
    css: {
      transformer: 'lightningcss',
    },
    build: {
      cssMinify: 'lightningcss',
      cssTarget: ['chrome111', 'edge111', 'firefox113', 'safari16.4'],
    },
  },
  trailingSlash: 'never',
  redirects: {
    '/events': '/event',
    '/events/[slug]': '/event/[slug]',
    '/ueber-uns': '/#ueber',
    '/admin': '/_emdash/admin',
    '/home': '/',
    '/atemuebung': '/',
    '/atemuebung/app': '/',
  },
  build: {
    assets: 'assets',
    inlineStylesheets: 'auto',
  },
  fonts: [
    {
      name: 'Cormorant',
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
      display: 'optional',
      cssVariable: '--font-geist',
      provider: fontProviders.local(),
      options: {
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
    emdash({
      database: sqlite({ url: `file:${databasePath}` }),
      images: false,
      imagePlaceholders: false,
      registry: false,
      mcp: false,
      updateCheck: false,
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

      customPages: [new URL('/', siteUrl).href, new URL('/event', siteUrl).href],

      customSitemaps: [new URL('/sitemap-events.xml', siteUrl).href],

      filter: page => !page.includes('/_emdash'),

      serialize(item) {
        const url = new URL(item.url)

        if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '')

        return { ...item, url: url.href }
      },
    }),
  ],
})
