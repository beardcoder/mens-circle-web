import { expect, test } from 'bun:test';

import { seatFill } from '../src/lib/shared/seats';
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
