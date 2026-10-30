import { expect, test } from 'bun:test';

import { seatRing } from '../src/lib/seats';

// The ring repeats the seats row in points; it must never claim more free seats than exist.

test('one point per seat, taken first, free last, starting at the top', () => {
  const ring = seatRing({ total: 8, free: 3 });

  expect(ring).toHaveLength(8);
  expect(ring.map((seat) => seat.free)).toEqual([false, false, false, false, false, true, true, true]);
  expect(ring[0]).toMatchObject({ x: '40.00', y: '5.00' });
});

test('free seats are clamped to the circle', () => {
  expect(seatRing({ total: 6, free: 9 }).every((seat) => seat.free)).toBe(true);
  expect(seatRing({ total: 6, free: -2 }).some((seat) => seat.free)).toBe(false);
});

test('no ring for a past evening or outside a circle size', () => {
  expect(seatRing(null)).toEqual([]);
  expect(seatRing({ total: 0, free: 0 })).toEqual([]);
  expect(seatRing({ total: 1, free: 1 })).toEqual([]);
  expect(seatRing({ total: 40, free: 12 })).toEqual([]);
});
