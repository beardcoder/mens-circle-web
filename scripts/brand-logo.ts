/**
 * Regenerates every logo and favicon file from the master drawing
 * (`brand/logo/logo.svg`) in the brand's colours: `bun scripts/brand-logo.ts`.
 * Edit the master only; `tests/brand-logo.test.ts` fails when an SVG drifts.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import sharp from 'sharp';

import { ico } from '../src/lib/brand/ico';
import { type LogoOptions, logoVariant } from '../src/lib/brand/logo';
import { BRAND } from '../src/lib/shared/brand';

const ROOT = resolve(import.meta.dir, '..');
const MASTER = 'brand/logo/logo.svg';

const EMBER: LogoOptions = { fill: BRAND.ember };
/** Favicons in a tab: a hair of air so the ring does not touch the edge. */
const TAB: LogoOptions = { fill: BRAND.ember, padding: 0.04 };
/** Home screen, maskable and touch icons: on linen, inside the 80 % safe circle. */
const TILE: LogoOptions = { fill: BRAND.ember, background: BRAND.linen, padding: 0.12 };

/** The SVG files, path → options; `src/icons/logo.svg` is the master itself. */
export const SVG_VARIANTS: Record<string, LogoOptions> = {
  'brand/logo/logo-ember.svg': EMBER,
  'brand/logo/logo-ember-on-linen.svg': { ...EMBER, background: BRAND.linen, padding: 0.1 },
  'brand/logo/logo-bone-on-forest.svg': { fill: BRAND.bone, background: BRAND.forest, padding: 0.1 },
  'brand/logo/logo-black.svg': { fill: '#000000' },
  'brand/logo/logo-white.svg': { fill: '#ffffff' },
  'public/favicon.svg': { ...TAB, darkFill: BRAND.emberLight },
  'public/images/logo.svg': EMBER,
  'public/images/logo-color.svg': EMBER,
};

/** Every referenced PNG at its existing name and size. */
const PNG_VARIANTS: [path: string, size: number, opts: LogoOptions][] = [
  ['public/images/logo.png', 395, EMBER],
  ['public/images/logo-color.png', 512, EMBER], // JSON-LD logo (SeoHead)
  ['public/images/logo-mail.png', 160, EMBER], // mail masthead, loaded by URL
  ['public/images/logo-flame.png', 160, EMBER], // mails already sent
  ['public/favicon-16x16.png', 16, TAB],
  ['public/favicon-32x32.png', 32, TAB],
  ['public/favicon-180x180.png', 180, TILE], // apple-touch-icon: iOS fills transparency black
  ...[72, 96, 128, 144, 152, 192, 384, 512].map(
    (size): [string, number, LogoOptions] => [`public/favicon-${size}x${size}.png`, size, TILE], // manifest, "any maskable"
  ),
];

const ICO_SIZES = [16, 32, 48];

const write = (path: string, data: string | Uint8Array): void => {
  const target = resolve(ROOT, path);

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  console.log(`wrote ${relative(ROOT, target)}`);
};

/** librsvg ignores `currentColor`, so every rasterised variant has an explicit fill. */
const png = async (svg: string, size: number): Promise<Uint8Array> => {
  const side = Number(/viewBox="[^ ]+ [^ ]+ ([^ ]+)/.exec(svg)?.[1] ?? size);
  // Render at twice the target, then scale down: smoother edges at small sizes.
  const density = (72 * 2 * size) / side;

  const buffer = await sharp(Buffer.from(svg), { density }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

  return new Uint8Array(buffer);
};

const writeSvgs = (master: string): void => {
  write('src/icons/logo.svg', master);

  for (const [path, opts] of Object.entries(SVG_VARIANTS)) write(path, logoVariant(master, opts));
};

const writePngs = async (master: string): Promise<void> => {
  for (const [path, size, opts] of PNG_VARIANTS) write(path, await png(logoVariant(master, opts), size));

  const svg = logoVariant(master, TAB);
  const images = await Promise.all(ICO_SIZES.map(async (size) => ({ size, png: await png(svg, size) })));

  write('public/favicon.ico', ico(images));
};

if (import.meta.main) {
  const master = readFileSync(resolve(ROOT, MASTER), 'utf8');

  writeSvgs(master);
  await writePngs(master);
}
