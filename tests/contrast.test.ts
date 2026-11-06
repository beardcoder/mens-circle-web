import { expect, test } from 'bun:test';

import { BRAND } from '../src/lib/shared/brand';

// The design system's promise (CLAUDE.md, "Design"): every text pair ≥ 4.5:1 on every
// ground in both modes, control lines ≥ 3:1. The colours are the --p-* primitives,
// held equal to theme.css by brand.test.ts.

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;

    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (hi + 0.05) / (lo + 0.05);
};

type Key = keyof typeof BRAND;

const MODES: Record<string, { grounds: Key[]; texts: Key[]; controls: Key[] }> = {
  light: {
    grounds: ['linen', 'sand', 'sage', 'cream'],
    texts: ['ink', 'inkSoft', 'muted', 'emberText'],
    controls: ['control'],
  },
  dark: {
    grounds: ['night', 'nightAlt', 'nightRaised', 'sageNight'],
    texts: ['nightText', 'nightMuted', 'emberLight'],
    controls: ['nightControl'],
  },
  'forest (light)': {
    grounds: ['forest', 'forestRaised'],
    texts: ['bone', 'boneMuted', 'emberLight'],
    controls: ['forestControl'],
  },
  'forest (dark)': {
    grounds: ['forestNight', 'forestRaisedNight'],
    texts: ['bone', 'boneMuted', 'emberLight'],
    controls: ['forestControl'],
  },
};

for (const [mode, { grounds, texts, controls }] of Object.entries(MODES)) {
  test(`${mode}: text ≥ 4.5:1 and control lines ≥ 3:1 on every ground`, () => {
    for (const ground of grounds) {
      for (const text of texts) {
        expect(ratio(BRAND[text], BRAND[ground]), `${text} on ${ground}`).toBeGreaterThanOrEqual(4.5);
      }

      for (const control of controls) {
        expect(ratio(BRAND[control], BRAND[ground]), `${control} on ${ground}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
}

test('the label on a filled button reads on both fills', () => {
  for (const fill of ['ember', 'emberDeep'] as const) {
    expect(ratio(BRAND.onEmber, BRAND[fill]), `onEmber on ${fill}`).toBeGreaterThanOrEqual(4.5);
  }
});
