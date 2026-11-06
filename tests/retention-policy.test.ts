import { readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';

import { DEFAULT_RETENTION_DAYS } from '../src/lib/shared/retention';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the privacy policy names the retention the job applies', () => {
  const policy = read('../src/pages/datenschutz.astro');

  expect(policy).toContain("import { DEFAULT_RETENTION_DAYS as DAYS } from '@lib/shared/retention';");
  expect(policy).toContain('{DAYS} Tage nach dem Termin');
  expect(policy).toContain('{DAYS} Tage nach der Veröffentlichung');
  // No hard-coded period that could drift from the constant.
  expect(policy).not.toMatch(new RegExp(`\\b${DEFAULT_RETENTION_DAYS} Tage nach`));
});

test('RETENTION_DAYS can shorten the period but never extend it beyond the policy', () => {
  const config = read('../src/lib/server/config.ts');

  expect(config).toMatch(/RETENTION_DAYS: Math\.min\(DEFAULT_RETENTION_DAYS,/);
});

test('the newsletter promise and the policy say the same', () => {
  const policy = read('../src/pages/datenschutz.astro');

  expect(policy).toContain('Andere Inhalte verschicke ich über diesen Verteiler');
  expect(policy).not.toContain('passende Impulse');
  expect(read('../src/pages/index.astro')).toContain('Mehr wird über diesen Verteiler nicht verschickt');
});
