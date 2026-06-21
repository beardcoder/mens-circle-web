/**
 * Resolve content image paths to bundled, build-optimisable assets.
 *
 * Content (JSON blocks, site data) references images with public-style paths
 * like "/images/markus-sommer.jpg". The actual source lives in
 * `src/assets/images/` so Astro can generate responsive AVIF/WebP at build
 * time. This eagerly globs those assets and maps a content path to its
 * `ImageMetadata`, so components can feed it to `<Image>` / `<Picture>`.
 *
 * Returns `null` for external URLs (http/https) or paths with no matching
 * bundled asset — callers should fall back to a plain `<img>` in that case.
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
