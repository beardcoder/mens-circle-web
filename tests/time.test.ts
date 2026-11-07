import { expect, test } from 'bun:test';

import {
  addDays,
  daySeal,
  eventDay,
  eventStart,
  formatDateLong,
  formatDateShort,
  formatDayMonthYear,
  formatTimeRange,
  isPast,
  todayBerlin,
  zonedTime,
} from '../src/lib/shared/time';

test('labels read the calendar day, whatever the stored form', () => {
  for (const stored of ['2026-09-18', '2026-09-18T00:00:00.000Z']) {
    expect(formatDateLong(stored)).toBe('Freitag, 18. September 2026');
    expect(formatDayMonthYear(stored)).toBe('18. September 2026');
    expect(formatDateShort(stored)).toBe('18.09.2026');
    expect(eventDay(stored)).toBe('2026-09-18');
  }

  expect(daySeal('2026-01-01').day).toBe('01');
  expect(daySeal('2026-01-01').month).toStartWith('Jan');
  expect(formatDateLong('')).toBe('');
  expect(formatDateLong('kein Datum')).toBe('');
});

test('one spelling of a time range, on pages and in mails', () => {
  expect(formatTimeRange('19:00', '21:30')).toBe('19:00–21:30 Uhr');
  expect(formatTimeRange('19:00', '')).toBe('19:00 Uhr');
  expect(formatTimeRange('', '21:30')).toBe('');
});

test('wall-clock times become the right instants in summer and winter', () => {
  expect(zonedTime('2026-07-15', '19:00')).toMatchObject({
    iso: '2026-07-15T19:00:00+02:00',
    wall: '20260715T190000',
  });
  expect(zonedTime('2026-07-15', '19:00')?.date.toISOString()).toBe('2026-07-15T17:00:00.000Z');
  expect(zonedTime('2026-12-10', '19:00')?.date.toISOString()).toBe('2026-12-10T18:00:00.000Z');
  expect(zonedTime('2026-12-10', '19:00')?.iso).toBe('2026-12-10T19:00:00+01:00');
  // The days the clocks change: before and after the switch.
  expect(zonedTime('2026-03-29', '01:30')?.iso).toBe('2026-03-29T01:30:00+01:00');
  expect(zonedTime('2026-03-29', '19:00')?.iso).toBe('2026-03-29T19:00:00+02:00');
  expect(zonedTime('2026-10-25', '19:00')?.iso).toBe('2026-10-25T19:00:00+01:00');
  expect(zonedTime('2026-10-25', 'abends')).toBeNull();
  expect(eventStart({ eventDate: '2026-07-15', startTime: '' })?.toISOString()).toBe('2026-07-14T22:00:00.000Z');
});

test('today and the past follow Berlin midnight, not UTC midnight', () => {
  // 23:30 UTC on 14 July is already 15 July in Berlin.
  const lateNight = new Date('2026-07-14T23:30:00Z');

  expect(todayBerlin(lateNight)).toBe('2026-07-15');
  expect(isPast('2026-07-14', lateNight)).toBe(true);
  expect(isPast('2026-07-15', lateNight)).toBe(false);
  // 22:30 UTC on 14 July is still the 14th in winter time, but the 15th in summer.
  expect(todayBerlin(new Date('2026-01-14T22:30:00Z'))).toBe('2026-01-14');
  expect(isPast('2026-01-14', new Date('2026-01-14T22:30:00Z'))).toBe(false);
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
});
