import { expect, test } from 'bun:test';
import { isDue, parseCron } from '../scripts/lib/cron';

// Pure logic, no imports with side effects — no fixture/spawn needed, see
// scripts/lib/cron.ts's own comment.

test('rejects an expression that is not exactly 5 fields', () => {
  expect(() => parseCron('* * * *')).toThrow();
  expect(() => parseCron('* * * * * *')).toThrow();
});

test('"*/15 * * * *" is due only on quarter-hour minutes', () => {
  const cron = '*/15 * * * *';
  expect(isDue(cron, new Date('2026-01-01T00:00:00Z'))).toBe(true);
  expect(isDue(cron, new Date('2026-01-01T00:15:00Z'))).toBe(true);
  expect(isDue(cron, new Date('2026-01-01T00:30:00Z'))).toBe(true);
  expect(isDue(cron, new Date('2026-01-01T00:45:00Z'))).toBe(true);
  expect(isDue(cron, new Date('2026-01-01T00:01:00Z'))).toBe(false);
  expect(isDue(cron, new Date('2026-01-01T00:14:00Z'))).toBe(false);
});

test('"0 3 * * *" is due once a day, at 03:00 UTC exactly', () => {
  const cron = '0 3 * * *';
  expect(isDue(cron, new Date('2026-01-01T03:00:00Z'))).toBe(true);
  expect(isDue(cron, new Date('2026-01-01T03:01:00Z'))).toBe(false);
  expect(isDue(cron, new Date('2026-01-01T02:00:00Z'))).toBe(false);
});

test('a comma list matches any of its exact values', () => {
  const cron = '0,30 * * * *';
  expect(isDue(cron, new Date('2026-01-01T00:00:00Z'))).toBe(true);
  expect(isDue(cron, new Date('2026-01-01T00:30:00Z'))).toBe(true);
  expect(isDue(cron, new Date('2026-01-01T00:15:00Z'))).toBe(false);
});

test('day-of-month, month and day-of-week all narrow the match', () => {
  // 2026-01-01 is a Thursday (UTC day-of-week 4).
  expect(isDue('0 0 1 1 *', new Date('2026-01-01T00:00:00Z'))).toBe(true);
  expect(isDue('0 0 2 1 *', new Date('2026-01-01T00:00:00Z'))).toBe(false);
  expect(isDue('0 0 * * 4', new Date('2026-01-01T00:00:00Z'))).toBe(true);
  expect(isDue('0 0 * * 1', new Date('2026-01-01T00:00:00Z'))).toBe(false);
});
