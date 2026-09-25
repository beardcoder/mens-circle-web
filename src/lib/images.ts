/** Map a content image path to the bundled asset in `src/assets/images/`, so components can hand it to `<Image>`/`<Picture>`. */
import type { ImageMetadata } from 'astro';

const assetImages = import.meta.glob<{ default: ImageMetadata }>('/src/assets/images/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
});

export function resolveAssetImage(path?: string): ImageMetadata | null {
  if (!path || /^https?:\/\//.test(path)) return null;
  // "/images/foo.jpg", "images/foo.jpg" and "foo.jpg" all become "foo.jpg".
  const file = path.replace(/^\/?(?:images|assets\/images)\//, '').replace(/^\/+/, '');
  return assetImages[`/src/assets/images/${file}`]?.default ?? null;
}
