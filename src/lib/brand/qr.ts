/**
 * A QR code as one SVG path, for the print templates (a flyer's way to the
 * registration). Each row's dark modules are merged into runs, so the path stays
 * short; the quiet zone is the template's business (`border: 0`).
 */
import { encode } from 'uqr';

export interface QrPath {
  /** Modules per side; the SVG's viewBox is `0 0 size size`. */
  size: number;
  d: string;
}

export const qrPath = (text: string): QrPath => {
  const { data, size } = encode(text, { ecc: 'M', border: 0 });
  const parts: string[] = [];

  data.forEach((row, y) => {
    let x = 0;

    while (x < size) {
      if (!row[x]) {
        x += 1;
        continue;
      }

      const start = x;

      while (x < size && row[x]) x += 1;

      parts.push(`M${start} ${y}h${x - start}v1h${start - x}z`);
    }
  });

  return { size, d: parts.join('') };
};
