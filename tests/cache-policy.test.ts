import { expect, test } from 'bun:test';

import { cacheControlForRoute } from '../src/lib/cache-policy';

// Pure string assertions: no server, no database, no build output.

test('nothing that carries live or signed-in state may be stored', () => {
  for (const pathname of [
    '/_emdash/admin',
    '/_emdash/admin/content/registrations',
    '/_emdash/api/plugins/mens-circle/register',
    '/_server-islands/Testimonials',
    '/_actions/register',
    '/anmeldung/absagen',
  ]) {
    expect(cacheControlForRoute(pathname)).toBe('private, no-store');
  }
});

test('a path that merely starts with the same letters is not private', () => {
  // The prefix test has to mean the segment, not the substring.
  expect(cacheControlForRoute('/_emdashfoo')).toBe('public, max-age=0, must-revalidate');
  expect(cacheControlForRoute('/anmeldungen')).toBe('public, max-age=0, must-revalidate');
});

test('public HTML is stored but revalidated, never served stale', () => {
  for (const pathname of ['/', '/event', '/event/2026-09-18', '/impressum', '/warum-ich-den-maennerkreis-leite']) {
    const value = cacheControlForRoute(pathname);

    expect(value).toBe('public, max-age=0, must-revalidate');
    // The seat count on an event page must never come out of a shared cache.
    expect(value).toContain('max-age=0');
    expect(value).toContain('must-revalidate');
  }
});
