// @ts-check
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Bridge that makes `@astrojs/sitemap` output actually reachable in production
 * under the `@wyattjoh/astro-bun-adapter`.
 *
 * The adapter serves static files from a `static-manifest.json` it builds by
 * walking `dist/client` in its `astro:build:done` hook. Astro `unshift`s the
 * adapter to the FRONT of the integration list (see astro/dist/integrations/
 * hooks.js), so the adapter's `astro:build:done` always runs *before*
 * `@astrojs/sitemap` writes `sitemap-index.xml` / `sitemap-*.xml`. The sitemap
 * files therefore never make it into the manifest and 404 in production —
 * exactly what Google reported.
 *
 * This integration must be registered *after* `sitemap()` in the `integrations`
 * array. Its `astro:build:done` then runs after the sitemap files exist, and it
 * appends them to the adapter's manifest so the Bun edge serves them like any
 * other static asset. It is a no-op when the adapter manifest is absent (dev,
 * or a different adapter), so it stays harmless if the setup changes.
 *
 * @returns {import('astro').AstroIntegration}
 */
export function serveSitemapWithBunAdapter() {
  /** @type {import('astro').AstroConfig | undefined} */
  let config;

  return {
    name: 'serve-sitemap-with-bun-adapter',
    hooks: {
      'astro:config:done': ({ config: resolved }) => {
        config = resolved;
      },
      'astro:build:done': async ({ dir }) => {
        if (!config) return;

        const manifestUrl = new URL('.astro-bun-adapter/static-manifest.json', config.build.server);
        const manifestPath = fileURLToPath(manifestUrl);

        /** @type {Record<string, { headers: Record<string, string>; filePath: string }>} */
        let manifest;
        try {
          manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
        } catch {
          // No adapter manifest (dev build or non-Bun adapter) — nothing to do.
          return;
        }

        const clientDir = fileURLToPath(dir);
        const files = (await readdir(clientDir)).filter((f) => /^sitemap.*\.xml$/.test(f));

        let changed = false;
        for (const file of files) {
          const pathname = `/${file}`;
          if (manifest[pathname]) continue; // already served (e.g. adapter fixed upstream)

          const content = await readFile(new URL(file, dir));
          const size = (await stat(new URL(file, dir))).size;
          const etag = createHash('sha256').update(content).digest('hex').slice(0, 16);

          manifest[pathname] = {
            headers: {
              'content-type': 'application/xml',
              'content-length': String(size),
              'cache-control': 'public, max-age=3600, must-revalidate',
              etag: `"${etag}"`,
            },
            filePath: file,
          };
          changed = true;
        }

        if (changed) {
          const { writeFile } = await import('node:fs/promises');
          await writeFile(manifestPath, JSON.stringify(manifest));
        }
      },
    },
  };
}
