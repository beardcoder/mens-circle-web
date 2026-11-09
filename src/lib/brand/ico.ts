/**
 * A Windows icon (`.ico`) holding PNG images, as every browser since IE 9 reads
 * them: a six-byte ICONDIR, one sixteen-byte ICONDIRENTRY per image, then the PNGs.
 */

export interface IcoImage {
  /** The PNG's side in pixels (1–256). */
  size: number;
  png: Uint8Array;
}

const HEADER = 6;
const ENTRY = 16;

export const ico = (images: IcoImage[]): Uint8Array => {
  const total = images.reduce((sum, { png }) => sum + png.length, HEADER + ENTRY * images.length);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let offset = HEADER + ENTRY * images.length;

  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, images.length, true);

  images.forEach(({ size, png }, index) => {
    if (size < 1 || size > 256) throw new Error(`An icon is 1–256 px, not ${size}.`);

    const entry = HEADER + ENTRY * index;

    view.setUint8(entry, size % 256); // width; 0 means 256
    view.setUint8(entry + 1, size % 256); // height
    view.setUint8(entry + 2, 0); // no palette
    view.setUint8(entry + 3, 0); // reserved
    view.setUint16(entry + 4, 1, true); // colour planes
    view.setUint16(entry + 6, 32, true); // bits per pixel
    view.setUint32(entry + 8, png.length, true);
    view.setUint32(entry + 12, offset, true);
    out.set(png, offset);
    offset += png.length;
  });

  return out;
};
