import { expect, test } from 'bun:test';

import { cacheControlForRoute } from '../src/lib/cache-policy';

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
    expect(cacheControlForRoute(pathname)).toBe('private, no-store');
  }
});

test('a path that merely starts with the same letters is not back-office', () => {
  // `/administration` would otherwise inherit the admin policy — harmless here,
  // but the prefix test has to mean the segment, not the substring.
  expect(cacheControlForRoute('/administration')).toBe('public, max-age=0, must-revalidate');
  expect(cacheControlForRoute('/adminfoo')).toBe('public, max-age=0, must-revalidate');
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
