import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { CARD_HEIGHT, CARD_WIDTH } from '../src/lib/og-card-size';

test('the shared event poster matches the dimensions declared by page metadata', () => {
  const png = readFileSync(new URL('../public/images/og-default.png', import.meta.url));
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.readUInt32BE(16)).toBe(CARD_WIDTH);
  expect(png.readUInt32BE(20)).toBe(CARD_HEIGHT);
});
