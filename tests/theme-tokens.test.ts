import { readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';

import { declarations, parseTheme } from '../src/lib/brand/theme-tokens';

const tokens = parseTheme(readFileSync(new URL('../src/styles/theme.css', import.meta.url), 'utf8'));

test('a declaration keeps its trailing comment as its note, and multi-line values whole', () => {
  const found = declarations(`
    --a: 1rem; /* the note */
    --b: linear(
      0,
      1
    );
  `);

  expect(found).toEqual([
    { name: '--a', value: '1rem', note: 'the note' },
    { name: '--b', value: 'linear( 0, 1 )', note: '' },
  ]);
});

test('the primitives resolve to hex in both modes', () => {
  expect(Object.keys(tokens.primitives).length).toBeGreaterThan(30);
  expect(tokens.primitives.linen).toEqual({ light: '#f4ede2', dark: '#f4ede2' });
  expect(tokens.primitives.moss).toEqual({ light: '#2a2119', dark: '#201912' });
});

test('the colour roles resolve through the primitives; mixed ones are marked', () => {
  const role = (name: string) => tokens.colours.find((c) => c.name === name)!;

  expect(role('ground').light).toEqual({ hex: '#f4ede2', primitive: 'linen' });
  expect(role('ground').dark).toEqual({ hex: '#17120e', primitive: 'night' });
  expect(role('fill').light.hex).toBe('#84481c');
  expect(role('overlay').derived).toBe(true);

  for (const c of tokens.colours.filter((x) => !x.derived)) {
    expect(c.light.hex, c.name).toMatch(/^#[0-9a-f]{6}$/);
    expect(c.dark.hex, c.name).toMatch(/^#[0-9a-f]{6}$/);
  }
});

test('type roles carry size, line height and tracking; space carries its steps', () => {
  const poster = tokens.type.find((t) => t.name === 'poster')!;

  expect(poster.size).toStartWith('clamp(');
  expect(poster.lineHeight).toBe('0.86');
  expect(poster.note).toContain('poster');
  expect(tokens.space.find((s) => s.name === 'section')!.steps).toEqual({
    base: '5.5rem',
    '48rem': '7rem',
    '64rem': '9rem',
  });
  expect(tokens.space.find((s) => s.name === 'overlap')!.steps.base).toBe('2.5rem');
  expect(tokens.breakpoints.map((b) => b.name)).toContain('--breakpoint-nav');
});
