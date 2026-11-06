import { expect, test } from 'bun:test';

import { candidateDays, reminderDue } from '../src/lib/server/reminder-window';

const at = (iso: string) => new Date(iso);

test('summer time: the evening before from 18:00 to 22:00 Berlin (UTC+2)', () => {
  const event = '2026-07-15T00:00:00.000Z';

  expect(reminderDue(event, '19:00', at('2026-07-13T23:00:00Z'))).toBeNull(); // 01:00 the day before
  expect(reminderDue(event, '19:00', at('2026-07-14T15:59:00Z'))).toBeNull(); // 17:59
  expect(reminderDue(event, '19:00', at('2026-07-14T16:00:00Z'))).toBe('tomorrow'); // 18:00
  expect(reminderDue(event, '19:00', at('2026-07-14T16:15:00Z'))).toBe('tomorrow');
  expect(reminderDue(event, '19:00', at('2026-07-14T19:59:00Z'))).toBe('tomorrow'); // 21:59
  expect(reminderDue(event, '19:00', at('2026-07-14T20:00:00Z'))).toBeNull(); // 22:00
});

test('winter time: the same wall-clock hours one UTC hour later (UTC+1)', () => {
  const event = '2026-12-10';

  expect(reminderDue(event, '19:00', at('2026-12-09T16:00:00Z'))).toBeNull(); // 17:00
  expect(reminderDue(event, '19:00', at('2026-12-09T16:59:00Z'))).toBeNull(); // 17:59
  expect(reminderDue(event, '19:00', at('2026-12-09T17:00:00Z'))).toBe('tomorrow'); // 18:00
  expect(reminderDue(event, '19:00', at('2026-12-09T23:30:00Z'))).toBeNull(); // 00:30 on the day
});

test('the day itself: from 10:00 until the start, never at night', () => {
  const event = '2026-07-15T00:00:00.000Z';

  expect(reminderDue(event, '19:00', at('2026-07-14T23:15:00Z'))).toBeNull(); // 01:15
  expect(reminderDue(event, '19:00', at('2026-07-15T07:59:00Z'))).toBeNull(); // 09:59
  expect(reminderDue(event, '19:00', at('2026-07-15T08:00:00Z'))).toBe('today'); // 10:00
  expect(reminderDue(event, '19:00', at('2026-07-15T16:59:00Z'))).toBe('today'); // 18:59
  expect(reminderDue(event, '19:00', at('2026-07-15T17:00:00Z'))).toBeNull(); // 19:00, started
  expect(reminderDue(event, '', at('2026-07-15T20:00:00Z'))).toBe('today'); // no start time: until midnight
  expect(reminderDue(event, '19:00', at('2026-07-16T08:00:00Z'))).toBeNull(); // the day after
});

test('the evening the clocks go back still means 18:00 Berlin', () => {
  // Summer time ends on 2026-10-25 at 03:00; that evening is UTC+1.
  expect(reminderDue('2026-10-26', '19:00', at('2026-10-25T16:59:00Z'))).toBeNull();
  expect(reminderDue('2026-10-26', '19:00', at('2026-10-25T17:00:00Z'))).toBe('tomorrow');
  // Summer time begins on 2026-03-29; that evening is UTC+2.
  expect(reminderDue('2026-03-30', '19:00', at('2026-03-29T15:59:00Z'))).toBeNull();
  expect(reminderDue('2026-03-30', '19:00', at('2026-03-29T16:00:00Z'))).toBe('tomorrow');
});

test('candidate days are Berlin days, not UTC days', () => {
  // 23:30 UTC on the 14th is already the 15th in Berlin.
  expect(candidateDays(at('2026-07-14T23:30:00Z'))).toEqual({ from: '2026-07-15', to: '2026-07-17' });
});
