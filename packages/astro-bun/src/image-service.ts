/**
 * Astro image service on Bun.Image (Bun ≥ 1.4): decode, resize and encode natively,
 * without Sharp. Astro has to run on Bun for this (`bun --bun astro build`).
 *
 * Bun.Image resizes but cannot crop, so `fit: 'cover'` with a different aspect ratio
 * is refused. Ask for `fit: 'outside'` instead (the smallest size that covers the box,
 * source ratio kept) and crop in CSS with `object-fit: cover`. AVIF encoding needs an
 * OS codec that Linux does not have.
 */
import type { ImageOutputFormat, LocalImageService } from 'astro';
import { baseService } from 'astro/assets';

const QUALITY: Record<string, number> = { low: 25, mid: 50, high: 80, max: 100 };
/** Astro's fits that keep the whole picture, mapped to Bun's. */
const FIT: Record<string, 'fill' | 'inside'> = {
  fill: 'fill',
  inside: 'inside',
  contain: 'inside',
  'scale-down': 'inside',
};

type BunImage = InstanceType<typeof Bun.Image>;

function quality(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : QUALITY[value];
}

function encode(image: BunImage, format: string, q: number | undefined): BunImage {
  switch (format) {
    case 'jpg':
    case 'jpeg':
      return image.jpeg({ quality: q });
    case 'png':
      return image.png();
    case 'webp':
      return image.webp({ quality: q });
    case 'avif':
      return image.avif({ quality: q });
    default:
      throw new Error(`Bun.Image cannot encode ${format}`);
  }
}

interface Size {
  width: number;
  height: number;
}

/** The box to resize into, from whichever of width and height Astro asked for. */
function box(transform: Partial<Size>, source: Size): Size {
  const width = transform.width ?? (transform.height! * source.width) / source.height;
  const height = transform.height ?? (transform.width! * source.height) / source.width;
  return { width: Math.round(width), height: Math.round(height) };
}

/** `outside`: the source scaled until it covers the box on both axes. */
function covering(target: Size, source: Size): Size {
  const scale = Math.max(target.width / source.width, target.height / source.height);
  return { width: Math.round(source.width * scale), height: Math.round(source.height * scale) };
}

type Transform = Parameters<LocalImageService['transform']>[1];

/** Resizes as Astro asked, or refuses what would need a crop. */
function resize(image: BunImage, transform: Transform, source: Size): BunImage {
  if (!transform.width && !transform.height) return image;
  const requested = box({ width: transform.width, height: transform.height }, source);
  const target = transform.fit === 'outside' ? covering(requested, source) : requested;
  const sameRatio = Math.abs(target.width / target.height - source.width / source.height) < 0.01;
  const fit = transform.fit ? FIT[transform.fit] : 'inside';
  if (!fit && !sameRatio) {
    throw new Error(`Bun.Image cannot crop (fit: "${transform.fit}") for ${transform.src}; crop in CSS instead.`);
  }
  return image.resize(target.width, target.height, { fit: fit ?? 'inside', withoutEnlargement: true });
}

const bunImageService: LocalImageService = {
  ...baseService,

  async transform(inputBuffer, transform, _config, logger) {
    if (typeof Bun === 'undefined' || typeof Bun.Image !== 'function') {
      throw new Error('The Bun.Image service needs Bun ≥ 1.4 at build time: run `bun --bun astro build`.');
    }
    if (transform.format === 'svg') return { data: inputBuffer, format: 'svg' };
    if (transform.background) logger.warn(`Bun.Image cannot flatten; background ignored for ${transform.src}`);

    const image = new Bun.Image(inputBuffer);
    const source = await image.metadata();
    const format = (transform.format ?? source.format) as ImageOutputFormat;
    const data = await encode(resize(image, transform, source), format, quality(transform.quality)).bytes();
    return { data, format };
  },
};

export default bunImageService;
