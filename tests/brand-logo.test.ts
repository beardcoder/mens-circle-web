import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'bun:test';

import { SVG_VARIANTS } from '../scripts/brand-logo';
import { ico } from '../src/lib/brand/ico';
import { logoVariant } from '../src/lib/brand/logo';
import { BRAND } from '../src/lib/shared/brand';

const ROOT = resolve(import.meta.dir, '..');
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');
const master = read('brand/logo/logo.svg');

const svgsIn = (dir: string): string[] =>
  readdirSync(resolve(ROOT, dir))
    .filter((name) => name.endsWith('.svg'))
    .map((name) => `${dir}/${name}`);

describe('logo files', () => {
  const allowed = new Set<string>([...Object.values(BRAND), '#000000', '#ffffff']);
  const files = [...svgsIn('brand/logo'), ...svgsIn('public/images'), 'public/favicon.svg'];

  test.each(files)('%s uses brand colours only', (path) => {
    const hexes = read(path).match(/#[0-9a-f]{3,8}\b/gi) ?? [];

    for (const hex of hexes) expect(allowed).toContain(hex.toLowerCase());
  });

  test.each(Object.entries(SVG_VARIANTS))('%s is what the master produces', (path, opts) => {
    expect(read(path)).toBe(logoVariant(master, opts));
  });

  test('the site icon is the master itself', () => {
    expect(read('src/icons/logo.svg')).toBe(master);
  });
});

describe('logoVariant', () => {
  test('pads into a square viewBox around the mark', () => {
    const svg = logoVariant(master, { fill: BRAND.ember, background: BRAND.linen, padding: 0.1 });
    const [x, y, w, h] = /viewBox="([^"]+)"/.exec(svg)![1]!.split(' ').map(Number);

    expect(w).toBe(h!);
    expect(w! * 0.8).toBeCloseTo(397, 2);
    expect(x! + w! / 2).toBeCloseTo(198, 2);
    expect(y! + h! / 2).toBeCloseTo(198.5, 2);
    expect(svg).toContain(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${BRAND.linen}"/>`);
    expect(svg).not.toContain('currentColor');
  });
});

describe('ico', () => {
  test('writes an ICONDIR and entries that point at each PNG', () => {
    const pngs = [16, 32, 48].map((size) => ({ size, png: new Uint8Array(size).fill(size) }));
    const out = ico(pngs);
    const view = new DataView(out.buffer);

    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(3);

    let offset = 6 + 16 * 3;

    pngs.forEach(({ size, png }, index) => {
      const entry = 6 + 16 * index;

      expect(view.getUint8(entry)).toBe(size);
      expect(view.getUint16(entry + 6, true)).toBe(32);
      expect(view.getUint32(entry + 8, true)).toBe(png.length);
      expect(view.getUint32(entry + 12, true)).toBe(offset);
      expect(out.slice(offset, offset + png.length)).toEqual(png);
      offset += png.length;
    });

    expect(out.length).toBe(offset);
  });

  test('stores 256 as 0 and refuses larger sizes', () => {
    expect(ico([{ size: 256, png: new Uint8Array(1) }])[6]).toBe(0);
    expect(() => ico([{ size: 512, png: new Uint8Array(1) }])).toThrow();
  });
});
