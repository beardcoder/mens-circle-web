/**
 * The token export for designers and printers: the parsed theme as W3C design
 * tokens (DTCG), as plain CSS custom properties, as an Adobe swatch exchange file
 * (`.ase`: Illustrator, InDesign, Affinity, Procreate) and as a GIMP/Inkscape
 * palette (`.gpl`). Pure functions; `scripts/brand-export.ts` writes the files.
 */
import { hexToRgb, rgbToCmyk } from './color';
import type { ThemeTokens } from './theme-tokens';

export interface Swatch {
  name: string;
  hex: string;
}

/** Every primitive once, its night value as `<name>-night` where it differs. */
export const swatches = (tokens: ThemeTokens): Swatch[] =>
  Object.entries(tokens.primitives).flatMap(([name, { light, dark }]) =>
    light === dark
      ? [{ name, hex: light }]
      : [
          { name, hex: light },
          { name: `${name}-night`, hex: dark },
        ],
  );

const colourToken = (hex: string, description = '') => {
  const rgb = hexToRgb(hex);

  return {
    $type: 'color',
    $value: { colorSpace: 'srgb', components: rgb.map((c) => Math.round((c / 255) * 10000) / 10000), hex },
    ...(description ? { $description: description } : {}),
    $extensions: { 'de.mens-circle': { cmyk: rgbToCmyk(rgb) } },
  };
};

const dimensionGroup = (decls: { name: string; value: string; note: string }[], prefix: string) =>
  Object.fromEntries(
    decls.map((d) => [
      d.name.replace(prefix, ''),
      { $type: 'dimension', $value: d.value, ...(d.note ? { $description: d.note } : {}) },
    ]),
  );

/** W3C design tokens (Community Group format), with CMYK as an extension. */
export const toDtcg = (tokens: ThemeTokens): Record<string, unknown> => ({
  $description: 'Männerkreis Niederbayern: design tokens, generated from src/styles/theme.css. Do not edit.',
  color: {
    primitive: Object.fromEntries(swatches(tokens).map((s) => [s.name, colourToken(s.hex)])),
    role: Object.fromEntries(
      tokens.colours
        .filter((c) => !c.derived && c.light.hex && c.dark.hex)
        .map((c) => [c.name, { light: colourToken(c.light.hex!, c.note), dark: colourToken(c.dark.hex!, c.note) }]),
    ),
  },
  font: Object.fromEntries(
    tokens.fonts.map((f) => [
      f.name.replace('--font-', ''),
      { $type: 'fontFamily', $value: f.value, $description: f.note },
    ]),
  ),
  type: Object.fromEntries(
    tokens.type.map((t) => [
      t.name,
      {
        $type: 'typography',
        $value: { fontSize: t.size, lineHeight: t.lineHeight, letterSpacing: t.letterSpacing },
        ...(t.note ? { $description: t.note } : {}),
      },
    ]),
  ),
  space: Object.fromEntries(
    tokens.space.map((s) => [
      s.name,
      { $type: 'dimension', $value: s.steps, ...(s.note ? { $description: s.note } : {}) },
    ]),
  ),
  size: dimensionGroup(tokens.sizes, '--container-'),
  radius: dimensionGroup(tokens.radii, '--radius-'),
  breakpoint: dimensionGroup(tokens.breakpoints, '--breakpoint-'),
});

/** Plain CSS custom properties: the primitives and every role by mode. */
export const toCss = (tokens: ThemeTokens): string => {
  const lines = [
    '/* Männerkreis Niederbayern: design tokens, generated from src/styles/theme.css. Do not edit. */',
    ':root {',
    ...swatches(tokens).map((s) => `  --p-${s.name}: ${s.hex};`),
    '',
    ...tokens.colours
      .filter((c) => !c.derived && c.light.hex && c.dark.hex)
      .flatMap((c) => [`  --color-${c.name}-light: ${c.light.hex};`, `  --color-${c.name}-dark: ${c.dark.hex};`]),
    '',
    ...tokens.type.map((t) => `  --text-${t.name}: ${t.size};`),
    '}',
    '',
  ];

  return lines.join('\n');
};

/** GIMP / Inkscape palette. */
export const toGpl = (tokens: ThemeTokens): string =>
  [
    'GIMP Palette',
    'Name: Männerkreis Niederbayern',
    'Columns: 4',
    '#',
    ...swatches(tokens).map((s) => {
      const [r, g, b] = hexToRgb(s.hex);

      return `${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${s.name}`;
    }),
    '',
  ].join('\n');

/**
 * Adobe Swatch Exchange 1.0: "ASEF", the version, the block count, then one block
 * per colour (type 0x0001; the name in UTF-16BE with a terminating zero; the model
 * "RGB "; three big-endian floats 0–1; type 2, a normal colour) inside a group.
 */
export const toAse = (tokens: ThemeTokens, group = 'Männerkreis'): Uint8Array => {
  const name = (text: string): number[] => {
    const units = [...text].map((c) => c.charCodeAt(0)).concat(0);

    return [units.length >> 8, units.length & 0xff, ...units.flatMap((u) => [u >> 8, u & 0xff])];
  };

  const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

  const f32 = (n: number) => {
    const view = new DataView(new ArrayBuffer(4));

    view.setFloat32(0, n);

    return [...new Uint8Array(view.buffer)];
  };

  const blocks: number[][] = [];
  const groupName = name(group);

  blocks.push([0xc0, 0x01, ...u32(groupName.length), ...groupName]);

  for (const s of swatches(tokens)) {
    const body = [
      ...name(s.name),
      ...'RGB '.split('').map((c) => c.charCodeAt(0)),
      ...hexToRgb(s.hex).flatMap((c) => f32(c / 255)),
      0,
      2,
    ];

    blocks.push([0x00, 0x01, ...u32(body.length), ...body]);
  }

  blocks.push([0xc0, 0x02, ...u32(0)]);

  return new Uint8Array([
    ...'ASEF'.split('').map((c) => c.charCodeAt(0)),
    0,
    1,
    0,
    0,
    ...u32(blocks.length),
    ...blocks.flat(),
  ]);
};
