/**
 * Logo variants as SVG strings, derived from the master drawing
 * (`brand/logo/logo.svg`, paths in `currentColor`). Pure and deterministic:
 * `scripts/brand-logo.ts` writes the files, `tests/brand-logo.test.ts` guards them.
 */

export interface LogoOptions {
  /** The mark's colour: a hex or `currentColor`. */
  fill: string;
  /** A square ground behind the mark; transparent when absent. */
  background?: string;
  /** Space around the mark on each side, as a fraction of the output's side (0–0.4). */
  padding?: number;
  /** The mark's colour under `prefers-color-scheme: dark` (an embedded style). */
  darkFill?: string;
}

interface Master {
  /** min-x, min-y, width, height of the master's viewBox. */
  box: [number, number, number, number];
  /** The root's attributes besides `xmlns` and `viewBox`. */
  attrs: string;
  paths: string[];
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** At most three decimals, no trailing zeros: the same input always prints the same. */
const num = (value: number): string => String(Number(value.toFixed(3)));

const parseMaster = (svg: string): Master => {
  const root = /<svg\b([^>]*)>/.exec(svg)?.[1] ?? '';
  const viewBox = /\bviewBox="([^"]+)"/.exec(root)?.[1] ?? '';
  const box = (viewBox.match(/[-+.\deE]+/g) ?? []).map(Number);

  if (box.length !== 4 || box.some(Number.isNaN)) {
    throw new Error('The master logo needs a numeric viewBox.');
  }

  const attrs = root
    .replace(/\s(xmlns|viewBox)="[^"]*"/g, '')
    .trim()
    .replace(/\s+/g, ' ');

  const paths = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(([, d]) => d!);

  if (paths.length === 0) throw new Error('The master logo has no paths.');

  return { box: box as Master['box'], attrs, paths };
};

/** A square viewBox around the master's, with `padding` of the side on each edge. */
const squareBox = ([x, y, w, h]: Master['box'], padding: number): Master['box'] => {
  if (padding < 0 || padding >= 0.5) throw new Error('padding must be in [0, 0.5).');

  const side = Math.max(w, h) / (1 - 2 * padding);

  return [x - (side - w) / 2, y - (side - h) / 2, side, side];
};

const darkStyle = (fill: string): string => `  <style>@media (prefers-color-scheme: dark){path{fill:${fill}}}</style>`;

export const logoVariant = (master: string, opts: LogoOptions): string => {
  const { box, attrs, paths } = parseMaster(master);
  const [x, y, w, h] = squareBox(box, opts.padding ?? 0).map(num);
  const lines = [`<svg xmlns="${SVG_NS}" viewBox="${x} ${y} ${w} ${h}" ${attrs}>`];

  if (opts.darkFill) lines.push(darkStyle(opts.darkFill));

  if (opts.background) {
    lines.push(`  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${opts.background}"/>`);
  }

  for (const d of paths) lines.push(`  <path fill="${opts.fill}" d="${d}"/>`);

  lines.push('</svg>', '');

  return lines.join('\n');
};
