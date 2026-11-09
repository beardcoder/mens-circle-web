import { expect, test } from 'bun:test';

import { seatDots, seatFill } from '../src/lib/shared/seats';
import { accentLastWord } from '../src/lib/shared/words';

// The bar repeats the seats line in a shape; it must never show more room than exists.

test('the bar fills with the taken seats', () => {
  expect(seatFill({ total: 8, free: 3 })).toBe(5 / 8);
  expect(seatFill({ total: 12, free: 12 })).toBe(0);
  expect(seatFill({ total: 7, free: 0 })).toBe(1);
});

test('free seats are clamped to the circle', () => {
  expect(seatFill({ total: 6, free: 9 })).toBe(0);
  expect(seatFill({ total: 6, free: -2 })).toBe(1);
});

test('no bar for a past evening or an evening without seats', () => {
  expect(seatFill(null)).toBeNull();
  expect(seatFill({ total: 0, free: 0 })).toBeNull();
});

test('a title sets its last word in the accent; one word stays plain', () => {
  expect(accentLastWord('Männerkreis im Advent')).toEqual({ lead: 'Männerkreis im', accent: 'Advent' });
  expect(accentLastWord(' Männerkreis ')).toEqual({ lead: 'Männerkreis', accent: '' });
});

test('the seat ring puts every chair on the ring, taken ones first from the top', () => {
  const ring = seatDots({ total: 8, free: 3 })!;

  expect(ring.dots).toHaveLength(8);
  expect(ring.dots[0]).toEqual({ x: 50, y: 10, taken: true });
  expect(ring.dots.filter((dot) => dot.taken)).toHaveLength(5);
  expect(ring.dots.slice(5).every((dot) => !dot.taken)).toBe(true);
  expect(ring.free).toBe(3);

  for (const dot of ring.dots) expect(Math.hypot(dot.x - 50, dot.y - 50)).toBeCloseTo(40, 1);
});

test('the seat ring shrinks its dots as chairs are added and shows nothing without seats', () => {
  expect(seatDots({ total: 7, free: 7 })!.r).toBe(6.5);
  expect(seatDots({ total: 30, free: 0 })!.r).toBeLessThan(3);
  expect(seatDots({ total: 30, free: 0 })!.dots.every((dot) => dot.taken)).toBe(true);
  expect(seatDots(null)).toBeNull();
  expect(seatDots({ total: 0, free: 0 })).toBeNull();
});
