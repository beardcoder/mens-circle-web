import { readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';

import { COLOUR_USE, TYPE_USE } from '../src/lib/brand/notes';
import { parseTheme } from '../src/lib/brand/theme-tokens';

const tokens = parseTheme(readFileSync(new URL('../src/styles/theme.css', import.meta.url), 'utf8'));

test('every styleguide note names a token of theme.css', () => {
  const colours = new Set(tokens.colours.map((c) => c.name));
  const type = new Set(tokens.type.map((t) => t.name));

  for (const name of Object.keys(COLOUR_USE)) expect(colours.has(name), `--color-${name}`).toBe(true);

  for (const name of Object.keys(TYPE_USE)) expect(type.has(name), `--text-${name}`).toBe(true);
});

test('every type role has a note in the styleguide', () => {
  for (const role of tokens.type) expect(TYPE_USE[role.name], `--text-${role.name}`).toBeDefined();
});
