import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';

import { BRAND, MAIL } from '../src/lib/shared/brand';

const theme = readFileSync(new URL('../src/styles/theme.css', import.meta.url), 'utf8');
const camel = (name: string) => name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

test('brand.ts and the --p-* primitives in theme.css name the same colours', () => {
  const primitives = [...theme.matchAll(/--p-([a-z-]+):\s*([^;]+);/g)];
  const fromTheme: Record<string, string> = {};

  for (const [, name, value] of primitives) {
    const hexes = value.match(/#[0-9a-f]{6}/gi) ?? [];

    fromTheme[camel(name)] = hexes[0]?.toLowerCase() ?? value;

    if (value.includes('light-dark')) fromTheme[`${camel(name)}Night`] = hexes[1]?.toLowerCase() ?? value;
  }

  expect(primitives.length).toBeGreaterThan(30);
  expect({ ...BRAND } as Record<string, string>).toEqual(fromTheme);
});

test('every colour in the listmonk templates is a brand colour', () => {
  const known = new Set<string>([...Object.values(BRAND), ...Object.values(MAIL)]);
  const dir = new URL('../listmonk-templates/', import.meta.url);

  for (const file of readdirSync(dir).filter((name) => name.endsWith('.html'))) {
    const html = readFileSync(new URL(file, dir), 'utf8');

    for (const hex of html.match(/#[0-9a-f]{6}\b/gi) ?? []) {
      expect(known.has(hex.toLowerCase()), `${file}: ${hex} is not in src/lib/shared/brand.ts`).toBe(true);
    }
  }
});
