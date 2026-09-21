import { expect, test } from 'bun:test';
import {
  cacheControlForFile,
  cacheControlForRoute,
  NO_CACHE,
  NO_STORE,
  PUBLIC_ASSET,
  REVALIDATE,
  SHORT,
} from '../src/lib/cache-policy';

// Pure string assertions: no server, no database, no build output.

test('nothing that carries live or signed-in state may be stored', () => {
  for (const pathname of [
    '/admin',
    '/admin/',
    '/admin/login',
    '/admin/testimonials',
    '/admin/events/abc/registrations',
    '/_server-islands/HomeEventStatus',
    '/_server-islands/Testimonials',
    '/_actions/register',
    '/_actions/setRegistrationStatus',
  ]) {
    expect(cacheControlForRoute(pathname)).toBe(NO_STORE);
  }
});

test('a path that merely starts with the same letters is not back-office', () => {
  // `/administration` would otherwise inherit the admin policy — harmless here,
  // but the prefix test has to mean the segment, not the substring.
  expect(cacheControlForRoute('/administration')).toBe(REVALIDATE);
  expect(cacheControlForRoute('/adminfoo')).toBe(REVALIDATE);
});

test('public HTML is stored but revalidated, never served stale', () => {
  for (const pathname of ['/', '/event', '/event/2026-09-18', '/impressum', '/warum-ich-den-maennerkreis-leite']) {
    expect(cacheControlForRoute(pathname)).toBe(REVALIDATE);
  }
  // The seat count on an event page must never come out of a shared cache.
  expect(REVALIDATE).toContain('max-age=0');
  expect(REVALIDATE).toContain('must-revalidate');
});

test('hashed bundles keep the adapter`s immutable policy', () => {
  // Returning a value here would overwrite `public, max-age=31536000, immutable`
  // on every hashed asset and every self-hosted font.
  expect(cacheControlForFile('/assets/page.Cd1e2f3g.js', 'assets')).toBeNull();
  expect(cacheControlForFile('/assets/fonts/2ba7ad3501f95450.woff2', 'assets')).toBeNull();
  expect(cacheControlForFile('/assets/markus-sommer.abc_ZcEGH6.webp', 'assets')).toBeNull();
  // …and the prefix is read from the build config, not assumed.
  expect(cacheControlForFile('/_astro/page.js', '_astro')).toBeNull();
});

test('unhashed files from public/ are cached for a week, refreshed in the background', () => {
  for (const pathname of [
    '/favicon.svg',
    '/favicon.ico',
    '/favicon-512x512.png',
    '/images/og-default.png',
    '/images/og-markus.jpg',
    '/images/logo.svg',
    '/logo-color.png',
  ]) {
    expect(cacheControlForFile(pathname, 'assets')).toBe(PUBLIC_ASSET);
  }
  // Not `immutable`: these names carry no hash, so a replaced file has to be
  // able to reach a cache that already holds the old bytes.
  expect(PUBLIC_ASSET).not.toContain('immutable');
  expect(PUBLIC_ASSET).toContain('stale-while-revalidate');
});

test('the retirement service worker is never pinned', () => {
  // public/sw.js unregisters the removed breathing app's worker. A cached copy
  // is a worker that cannot retire itself.
  expect(cacheControlForFile('/sw.js', 'assets')).toBe(NO_CACHE);
});

test('crawler and installer files stay changeable within the hour', () => {
  expect(cacheControlForFile('/robots.txt', 'assets')).toBe(SHORT);
  expect(cacheControlForFile('/manifest.webmanifest', 'assets')).toBe(SHORT);
});

test('HTML and generated files are left to their own owners', () => {
  // HTML carries what Astro.response.headers held at prerender time, and the
  // sitemaps / llms.txt carry what publish-generated-files.mjs gave them.
  for (const pathname of [
    '/impressum/index.html',
    '/index.html',
    '/llms.txt',
    '/llms-full.txt',
    '/index.md',
    '/sitemap-0.xml',
    '/sitemap-index.xml',
  ]) {
    expect(cacheControlForFile(pathname, 'assets')).toBeNull();
  }
});
