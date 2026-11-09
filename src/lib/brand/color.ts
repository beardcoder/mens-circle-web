/** Colour arithmetic for the styleguide, the token export and the contrast test. Pure. */

export const hexToRgb = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

/**
 * A naive CMYK from sRGB, in percent. Only a starting point for a printer: the
 * values that count come from a proof on the paper used (docs/brand/README.md).
 */
export const rgbToCmyk = ([r, g, b]: [number, number, number]): [number, number, number, number] => {
  const [rr, gg, bb] = [r, g, b].map((c) => c / 255);
  const k = 1 - Math.max(rr, gg, bb);

  if (k >= 1) return [0, 0, 0, 100];

  const part = (c: number) => Math.round(((1 - c - k) / (1 - k)) * 100);

  return [part(rr), part(gg), part(bb), Math.round(k * 100)];
};

/** Relative luminance (WCAG 2). */
export const luminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map((value) => {
    const c = value / 255;

    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Contrast ratio between two colours (WCAG 2), from 1 to 21. */
export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (hi + 0.05) / (lo + 0.05);
};
