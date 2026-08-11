/**
 * Map a content image path ("/images/markus-sommer.jpg") to the bundled asset in
 * `src/assets/images/`, so components can hand it to `<Image>` / `<Picture>` and
 * Astro can generate responsive AVIF/WebP.
 *
 * `null` for external URLs or unmatched paths — callers fall back to `<img>`.
 */
import type { ImageMetadata } from 'astro';

const assetImages = import.meta.glob<{ default: ImageMetadata }>('/src/assets/images/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
});

export function resolveAssetImage(path?: string): ImageMetadata | null {
  if (!path || /^https?:\/\//.test(path)) return null;
  // Normalise "/images/foo.jpg", "images/foo.jpg" or "foo.jpg" → "foo.jpg".
  const file = path.replace(/^\/?(?:images|assets\/images)\//, '').replace(/^\/+/, '');
  return assetImages[`/src/assets/images/${file}`]?.default ?? null;
}
