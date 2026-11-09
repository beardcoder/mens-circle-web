import { readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';

import { brandFiles } from '../src/lib/brand/export';
import { parseTheme } from '../src/lib/brand/theme-tokens';

const theme = readFileSync(new URL('../src/styles/theme.css', import.meta.url), 'utf8');
const files = brandFiles(theme);

test('the committed token export matches theme.css (run `bun run brand:export`)', () => {
  for (const [name, content] of Object.entries(files)) {
    const committed = readFileSync(new URL(`../brand/${name}`, import.meta.url));

    expect(Buffer.from(content).equals(committed), `brand/${name} is out of date`).toBe(true);
  }
});

test('the Adobe swatch file has a valid header and one block per colour plus the group', () => {
  const ase = files['palette.ase'] as Uint8Array;
  const view = new DataView(ase.buffer, ase.byteOffset);
  const colours = Object.values(parseTheme(theme).primitives).reduce((n, p) => n + (p.light === p.dark ? 1 : 2), 0);

  expect(new TextDecoder().decode(ase.slice(0, 4))).toBe('ASEF');
  expect([view.getUint16(4), view.getUint16(6)]).toEqual([1, 0]);
  expect(view.getUint32(8)).toBe(colours + 2);
  expect(view.getUint16(12)).toBe(0xc001);
});

test('the DTCG file names every role in both modes, with CMYK', () => {
  const json = JSON.parse(files['tokens.json'] as string);

  expect(json.color.role.fill.light.$value.hex).toBe('#b4532a');
  expect(json.color.role.ground.dark.$value.hex).toBe('#0f1410');
  expect(json.color.primitive.spark.$extensions['de.mens-circle'].cmyk).toHaveLength(4);
  expect(json.type.poster.$value.lineHeight).toBe('0.86');
});
