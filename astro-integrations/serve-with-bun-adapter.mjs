// @ts-check
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Publish files that OTHER integrations generate at `astro:build:done` under
 * `@wyattjoh/astro-bun-adapter`. The adapter builds its `static-manifest.json`
 * in its own `astro:build:done` hook, and Astro unshifts the adapter to the
 * front of the list, so anything written later never enters the manifest and
 * 404s in production. Register this AFTER the integration whose output it
 * publishes. No-op without the adapter manifest.
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
          return;
        }

        const files = (await readdir(fileURLToPath(dir))).filter(match);
        const published = [];

        for (const file of files) {
          const pathname = `/${file}`;
          if (manifest[pathname]) continue;

          // One read serves both the ETag and `content-length`, which must be
          // the byte length.
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
 * Publish the `astro-llms-md` output: the index/full files plus the per-page
 * markdown llms.txt links to. Register AFTER `llms()`.
 *
 * @returns {import('astro').AstroIntegration}
 */
export const serveLlmsWithBunAdapter = () =>
  serveWithBunAdapter({
    name: 'serve-llms-with-bun-adapter',
    match: (file) => /^llms(-full)?\.txt$/.test(file) || file.endsWith('.md'),
    contentType: (file) => (file.endsWith('.md') ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8'),
  });
