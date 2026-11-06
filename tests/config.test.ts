import { expect, test } from 'bun:test';

import { loadConfig } from '../src/lib/server/config';

// loadConfig is pure: no process, no .env, no import-time reading in the test.
test('an empty environment gives safe defaults', () => {
  const config = loadConfig({});

  expect(config.ADMIN_SESSION_SECRET).toBe('');
  expect(config.TRUSTED_PROXY).toBe('none');
  expect(config.RETENTION_DAYS).toBe(30);
  expect(config.LISTMONK_LIST_IDS).toEqual([]);
  expect(config.APP_URL).toBe('https://mens-circle.de');
});

test('values are trimmed and checked', () => {
  const config = loadConfig({
    APP_URL: 'https://example.invalid///',
    ADMIN_EMAIL: ' A@Example.invalid, ,b@example.invalid',
    LISTMONK_LIST_IDS: '3, 9,abc-uuid',
    RETENTION_DAYS: '90',
    TRUSTED_PROXY: 'cloudflare',
  });

  expect(config.APP_URL).toBe('https://example.invalid');
  expect(config.ADMIN_EMAILS).toEqual(['a@example.invalid', 'b@example.invalid']);
  expect(config.LISTMONK_LIST_IDS).toEqual([3, 9]);
  expect(config.RETENTION_DAYS).toBe(30);
  expect(config.TRUSTED_PROXY).toBe('cloudflare');
  expect(loadConfig({ RETENTION_DAYS: '14' }).RETENTION_DAYS).toBe(14);
});
