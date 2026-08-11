// @ts-check
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Make files that OTHER integrations generate at `astro:build:done` reachable
 * under `@wyattjoh/astro-bun-adapter`.
 *
 * The adapter serves static files from a `static-manifest.json` it builds in its
 * own `astro:build:done` hook — and Astro unshifts the adapter to the front of
 * the integration list, so that hook always runs first. Anything written later
 * (the sitemap index, llms.txt, the per-page `*.md`) never enters the manifest
 * and 404s in production.
 *
 * This factory returns an integration that appends the matching files to the
 * manifest afterwards. Register it *after* the integration whose output it
 * publishes. No-op without the adapter manifest (dev, or a different adapter).
 *
 * @param {object} options
 * @param {string} options.name Integration name, as it appears in build logs.
 * @param {(file: string) => boolean} options.match Which root-level files of
 *   `dist/client` to publish.
 * @param {(file: string) => string} options.contentType `content-type` header
 *   for a matched file.
 * @param {string} [options.cacheControl] `cache-control` header for matched
 *   files. Defaults to one hour, revalidated.
 * @returns {import('astro').AstroIntegration}
 */
export function serveWithBunAdapter({
  name,
  match,
  contentType,
  cacheControl = 'public, max-age=3600, must-revalidate',
}) {
  /** @type {import('astro').AstroConfig | undefined} */
  let config;

  return {
    name,
    hooks: {
      'astro:config:done': ({ config: resolved }) => {
        config = resolved;
      },
      'astro:build:done': async ({ dir, logger }) => {
        if (!config) return;

        const manifestPath = fileURLToPath(new URL('.astro-bun-adapter/static-manifest.json', config.build.server));

        /** @type {Record<string, { headers: Record<string, string>; filePath: string }>} */
        let manifest;
        try {
          manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
        } catch {
          // No adapter manifest (dev build or non-Bun adapter) — nothing to do.
          return;
        }

        const files = (await readdir(fileURLToPath(dir))).filter(match);
        const published = [];

        for (const file of files) {
          const pathname = `/${file}`;
          if (manifest[pathname]) continue; // already served (e.g. adapter fixed upstream)

          // One read serves both the length and the ETag — `content-length` must
          // be the byte length, which is what the buffer's own length is.
          const content = await readFile(new URL(file, dir));
          const etag = createHash('sha256').update(content).digest('hex').slice(0, 16);

          manifest[pathname] = {
            headers: {
              'content-type': contentType(file),
              'content-length': String(content.byteLength),
              'cache-control': cacheControl,
              etag: `"${etag}"`,
            },
            filePath: file,
          };
          published.push(pathname);
        }

        if (published.length > 0) {
          await writeFile(manifestPath, JSON.stringify(manifest));
          logger.info(`Registered ${published.length} file(s) with the Bun adapter: ${published.join(', ')}`);
        }
      },
    },
  };
}

/**
 * Publish the `@astrojs/sitemap` output. Register AFTER `sitemap()`.
 *
 * @returns {import('astro').AstroIntegration}
 */
export const serveSitemapWithBunAdapter = () =>
  serveWithBunAdapter({
    name: 'serve-sitemap-with-bun-adapter',
    match: (file) => /^sitemap.*\.xml$/.test(file),
    contentType: () => 'application/xml',
  });

/**
 * Publish the `astro-llms-md` output: the llms index/full files plus the
 * per-page markdown that llms.txt links to, all emitted at the client root.
 * Register AFTER `llms()`.
 *
 * @returns {import('astro').AstroIntegration}
 */
export const serveLlmsWithBunAdapter = () =>
  serveWithBunAdapter({
    name: 'serve-llms-with-bun-adapter',
    match: (file) => /^llms(-full)?\.txt$/.test(file) || file.endsWith('.md'),
    contentType: (file) => (file.endsWith('.md') ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8'),
  });
