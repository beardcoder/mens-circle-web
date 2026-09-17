// @ts-check
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Pre-render the responsive variants of the images that **on-demand** pages
 * show, at build time, and hand the markup the finished URLs.
 *
 * Why this exists: `astro:assets` decides where an image is resized by asking
 * whether the page rendering it is prerendered. For a prerendered page it emits
 * the files during the build and writes a static URL; for an on-demand page it
 * can't know the props ahead of time, so it writes `/_image?href=…&w=…&f=avif`
 * and resizes on request. The home page is on demand — its hero has to state
 * the real scheduling status when the HTML arrives — so its photograph was the
 * one thing still pulling **libvips** into the long-lived web process. That is
 * ~55MB of native memory, outside the Bun heap where `--smol` cannot reach it,
 * held for the life of the container so that one decorative portrait could be
 * re-encoded for every cold visitor.
 *
 * Nothing about that photo is dynamic: it is a file in `src/assets/images/`,
 * at widths this repo chose. So it is resized here instead, once per build,
 * and the page ships plain `<source>`/`<img>` URLs. The runtime never needs a
 * rasteriser — see **RAM** in CLAUDE.md, and keep it that way.
 *
 * Three consequences worth knowing:
 *
 *  1. **The output goes to `public/generated/`** (gitignored). That is the one
 *     directory Astro serves in `astro dev` *and* copies into `dist/client` for
 *     the build, so one code path covers both and the Bun adapter picks the
 *     files up with the rest of the static tree — no manifest patching like the
 *     sitemap needs.
 *  2. **The filename carries a hash of the source bytes**, so replacing the
 *     photo changes every URL. Nothing here is cache-busted by a query string.
 *  3. **Encoding is skipped when the file is already there**, which is what
 *     keeps `astro check` and repeat builds free. A cold pass costs ~5s.
 *
 * The one thing `public/` costs is the cache header: the Bun adapter serves
 * that tree with a day's revalidated cache, because a hand-placed file can be
 * replaced in place. These cannot — the hash is in the name — so the
 * `astro:build:done` hook below upgrades them to `immutable`, the same header
 * the adapter gives Astro's own hashed output.
 *
 * The encoder settings are the point of the exercise and are measured, not
 * guessed — see the note on `ENCODERS`.
 */

const VIRTUAL_ID = 'virtual:hero-images';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/** Where the generated files land, relative to `publicDir`, and the URL prefix
 *  they are served under. The same string, because `public/` is served at the
 *  site root. */
const OUT_DIR = 'generated/hero';

/**
 * Encoder settings, chosen by measurement against this repo's own photograph
 * (1024x1024 portrait) rather than by taste. Sizes at 420/640/900, and PSNR
 * against the losslessly resized original at 900:
 *
 *              Astro's defaults          here
 *   avif    16.0 / 29.7 / 48.8kB   12.3 / 23.2 / 39.5kB   36.1dB → 34.7dB
 *   webp    32.6 / 59.1 / 91.5kB   25.8 / 46.6 / 71.1kB   37.7dB → 36.1dB
 *   jpeg    38.6 / 76.0 /129.5kB   29.1 / 56.6 / 96.4kB   38.4dB → 37.4dB
 *
 * About a quarter off every variant for ~1dB, which for a decorative portrait
 * displayed a third of the viewport wide is not visible. Two specifics:
 * sharp encodes AVIF at 4:4:4 by default, which a photograph does not need,
 * and `mozjpeg` is worth a quarter of the JPEG on its own.
 *
 * `effort` is deliberately NOT maxed. This runs at build time, so slow would be
 * affordable — but it does not buy anything: AVIF at effort 6 costs 5.6s per
 * width against 2.0s at 4, and returns 2% of the bytes. WebP is the opposite:
 * effort 6 costs 330ms, so it is on.
 */
const ENCODERS = [
  {
    ext: 'avif',
    type: 'image/avif',
    /** @param {import('sharp').Sharp} pipeline */
    encode: (pipeline) => pipeline.avif({ quality: 45, chromaSubsampling: '4:2:0' }),
  },
  {
    ext: 'webp',
    type: 'image/webp',
    /** @param {import('sharp').Sharp} pipeline */
    encode: (pipeline) => pipeline.webp({ quality: 74, effort: 6, smartSubsample: true }),
  },
  {
    // Last, and the one the bare <img> points at: every browser reads it.
    ext: 'jpg',
    type: 'image/jpeg',
    /** @param {import('sharp').Sharp} pipeline */
    encode: (pipeline) => pipeline.jpeg({ quality: 76, mozjpeg: true, progressive: true }),
  },
];

/**
 * @typedef {object} HeroSource
 * @property {string} src The path as `src/content/*.json` writes it, e.g.
 *   "/images/markus-sommer.jpg". This is the manifest key.
 * @property {number[]} widths Rendered widths, smallest first.
 */

/**
 * @typedef {object} HeroImage
 * @property {number} width Intrinsic width of the fallback — with `height`,
 *   what reserves the box and keeps the layout from shifting.
 * @property {number} height
 * @property {{ type: string; srcset: string }[]} sources `<source>` elements,
 *   best format first.
 * @property {string} src `<img src>` — the largest JPEG, never the original.
 * @property {string} srcset `<img srcset>`, the JPEG ladder.
 */

/**
 * @param {object} options
 * @param {HeroSource[]} options.sources Images rendered by on-demand pages.
 * @returns {import('astro').AstroIntegration}
 */
export function heroImages({ sources }) {
  /** @type {Record<string, HeroImage>} */
  const manifest = {};
  /** @type {URL | undefined} */
  let serverDir;

  return {
    name: 'hero-images',
    hooks: {
      'astro:config:setup': async ({ config, updateConfig, logger }) => {
        serverDir = config.build.server;
        const outDir = new URL(`${OUT_DIR}/`, config.publicDir);
        await mkdir(outDir, { recursive: true });

        // Only this build's files may survive: a width or a quality setting
        // that changed would otherwise leave the old bytes served forever,
        // because nothing else ever deletes from `public/`.
        const keep = new Set();
        let encoded = 0;
        const existing = new Set(await readdir(outDir));

        const sharp = (await import('sharp')).default;

        for (const source of sources) {
          const file = source.src.replace(/^\/?(?:images|assets\/images)\//, '');
          const input = new URL(`images/${file}`, new URL('assets/', config.srcDir));
          const bytes = await readFile(input);
          // Eight hex digits of the source, the same budget Astro's own asset
          // names use. It is a cache key, not a signature.
          const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
          const base = file.replace(/\.[^.]+$/, '');

          /** @type {{ type: string; srcset: string }[]} */
          const pictureSources = [];
          /** @type {string[]} */
          let fallbackSrcset = [];

          for (const encoder of ENCODERS) {
            const srcset = [];
            for (const width of source.widths) {
              const name = `${base}-${digest}-${width}.${encoder.ext}`;
              keep.add(name);
              if (!existing.has(name)) {
                const out = await encoder.encode(sharp(bytes).resize(width, width, { fit: 'cover' })).toBuffer();
                await writeFile(new URL(name, outDir), out);
                encoded++;
              }
              srcset.push(`/${OUT_DIR}/${name} ${width}w`);
            }
            if (encoder.ext === 'jpg') fallbackSrcset = srcset;
            else pictureSources.push({ type: encoder.type, srcset: srcset.join(', ') });
          }

          const largest = source.widths[source.widths.length - 1];
          manifest[source.src] = {
            width: largest,
            height: largest,
            sources: pictureSources,
            src: `/${OUT_DIR}/${base}-${digest}-${largest}.jpg`,
            srcset: fallbackSrcset.join(', '),
          };
        }

        for (const name of existing) {
          if (!keep.has(name)) await rm(new URL(name, outDir));
        }

        if (encoded > 0) logger.info(`Encoded ${encoded} variant(s) into public/${OUT_DIR}/`);

        updateConfig({
          vite: {
            plugins: [
              {
                name: 'hero-images-manifest',
                resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : null),
                load: (id) => (id === RESOLVED_ID ? `export const heroImages = ${JSON.stringify(manifest)};` : null),
              },
            ],
          },
        });
      },

      // The adapter has already written its static manifest by now (Astro runs
      // the adapter's hook first — see serve-with-bun-adapter.mjs for the same
      // ordering problem). These URLs name their own content, so a browser that
      // has one never needs to ask about it again.
      'astro:build:done': async ({ logger }) => {
        if (!serverDir) return;

        const manifestPath = fileURLToPath(new URL('.astro-bun-adapter/static-manifest.json', serverDir));
        /** @type {Record<string, { headers: Record<string, string> }>} */
        let staticManifest;
        try {
          staticManifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
        } catch {
          return; // No adapter manifest (dev, or a different adapter).
        }

        let patched = 0;
        for (const [pathname, entry] of Object.entries(staticManifest)) {
          if (!pathname.startsWith(`/${OUT_DIR}/`)) continue;
          entry.headers['cache-control'] = 'public, max-age=31536000, immutable';
          patched++;
        }

        if (patched > 0) {
          await writeFile(manifestPath, JSON.stringify(staticManifest));
          logger.info(`Marked ${patched} generated image(s) immutable`);
        }
      },
    },
  };
}
