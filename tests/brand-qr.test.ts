import { expect, test } from 'bun:test';

import { encode } from 'uqr';

import { qrPath } from '../src/lib/brand/qr';

test('a QR code becomes one path that covers exactly its dark modules', () => {
  const url = 'https://mens-circle.de/event/maennerkreis-2026-11-20';
  const { size, d } = qrPath(url);
  const { data } = encode(url, { ecc: 'M', border: 0 });

  expect(size % 2).toBe(1);
  expect(size).toBeGreaterThanOrEqual(21);

  const dark = data.flat().filter(Boolean).length;
  const covered = [...d.matchAll(/h(\d+)v1/g)].reduce((sum, [, run]) => sum + Number(run), 0);

  expect(covered).toBe(dark);
  // The finder pattern in the top left corner: a full first row of seven.
  expect(d.startsWith('M0 0h7v1h-7z')).toBe(true);
});
