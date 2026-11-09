import { expect, test } from 'bun:test';

import { contrast as ratio } from '../src/lib/brand/color';
import { BRAND } from '../src/lib/shared/brand';

// The design system's promise (CLAUDE.md, "Design"): every text pair ≥ 4.5:1 on every
// ground in both modes, control lines ≥ 3:1. The colours are the --p-* primitives,
// held equal to theme.css by brand.test.ts.

type Key = keyof typeof BRAND;

const MODES: Record<string, { grounds: Key[]; texts: Key[]; controls: Key[] }> = {
  light: {
    grounds: ['linen', 'sand', 'cream'],
    texts: ['ink', 'inkSoft', 'muted', 'emberText'],
    controls: ['control'],
  },
  dark: {
    grounds: ['night', 'nightAlt', 'nightRaised'],
    texts: ['nightText', 'nightMuted', 'emberLight', 'spark'],
    controls: ['nightControl'],
  },
  'forest (light)': {
    grounds: ['forest', 'forestRaised'],
    texts: ['bone', 'boneMuted', 'emberLight', 'spark'],
    controls: ['forestControl'],
  },
  'forest (dark)': {
    grounds: ['forestNight', 'forestRaisedNight'],
    texts: ['bone', 'boneMuted', 'emberLight', 'spark'],
    controls: ['forestControl'],
  },
  // The moss is dark in both modes; its fields and controls use their own outline.
  'moss (light)': {
    grounds: ['moss'],
    texts: ['bone', 'boneMuted', 'emberLight', 'spark'],
    controls: ['mossControl'],
  },
  'moss (dark)': {
    grounds: ['mossNight'],
    texts: ['bone', 'boneMuted', 'emberLight', 'spark'],
    controls: ['mossControl'],
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

test('the accent reads on its own tint (the date seal, the FAQ disc)', () => {
  expect(ratio(BRAND.emberText, BRAND.emberTint)).toBeGreaterThanOrEqual(4.5);
  expect(ratio(BRAND.emberLight, BRAND.emberTintNight)).toBeGreaterThanOrEqual(4.5);
});

test('the label on a filled button reads on both fills', () => {
  for (const fill of ['ember', 'emberDeep'] as const) {
    expect(ratio(BRAND.onEmber, BRAND[fill]), `onEmber on ${fill}`).toBeGreaterThanOrEqual(4.5);
  }
});
