/**
 * Writes the token export into brand/ from src/styles/theme.css: tokens.json (W3C
 * design tokens), tokens.css, palette.ase (Adobe) and palette.gpl (GIMP, Inkscape).
 * Run after every change to the theme: `bun run brand:export`. The files are
 * committed; tests/brand-export.test.ts fails when they no longer match the theme.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { brandFiles } from '../src/lib/brand/export';

const theme = await readFile(new URL('../src/styles/theme.css', import.meta.url), 'utf8');
const out = new URL('../brand/', import.meta.url);

await mkdir(out, { recursive: true });

for (const [name, content] of Object.entries(brandFiles(theme))) {
  await writeFile(new URL(name, out), content);
  console.info(`brand/${name}`);
}
