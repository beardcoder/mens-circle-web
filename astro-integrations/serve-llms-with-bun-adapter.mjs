// @ts-check
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Bridge that makes `astro-llms-md` output actually reachable in production
 * under the `@wyattjoh/astro-bun-adapter` — the exact same problem the sibling
 * `serve-sitemap-with-bun-adapter` solves for the sitemap.
 *
 * The adapter serves static files from a `static-manifest.json` it builds by
 * walking `dist/client` in its `astro:build:done` hook. Astro `unshift`s the
 * adapter to the FRONT of the integration list, so its `astro:build:done` runs
 * *before* `astro-llms-md` writes `llms.txt` / `llms-full.txt` and the per-page
 * `*.md` files. Those files therefore never make it into the manifest and would
 * 404 in production — just like the sitemap did.
 *
 * This integration must be registered *after* `llms()` in the `integrations`
 * array. Its `astro:build:done` then runs after the llms files exist, and it
 * appends them (with the right text/plain and text/markdown content types) to
 * the adapter's manifest so the Bun edge serves them like any other static
 * asset. It is a no-op when the adapter manifest is absent (dev, or a different
 * adapter), so it stays harmless if the setup changes.
 *
 * @returns {import('astro').AstroIntegration}
 */
export function serveLlmsWithBunAdapter() {
  /** @type {import('astro').AstroConfig | undefined} */
  let config;

  return {
    name: 'serve-llms-with-bun-adapter',
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
        // The generated llms index/full files plus the per-page markdown that
        // llms.txt links to — all emitted at the client root by astro-llms-md.
        const files = (await readdir(clientDir)).filter((f) => /^llms(-full)?\.txt$/.test(f) || f.endsWith('.md'));

        let changed = false;
        for (const file of files) {
          const pathname = `/${file}`;
          if (manifest[pathname]) continue; // already served

          const content = await readFile(new URL(file, dir));
          const size = (await stat(new URL(file, dir))).size;
          const etag = createHash('sha256').update(content).digest('hex').slice(0, 16);
          const contentType = file.endsWith('.md') ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8';

          manifest[pathname] = {
            headers: {
              'content-type': contentType,
              'content-length': String(size),
              'cache-control': 'public, max-age=3600, must-revalidate',
              etag: `"${etag}"`,
            },
            filePath: file,
          };
          changed = true;
        }

        if (changed) {
          await writeFile(manifestPath, JSON.stringify(manifest));
        }
      },
    },
  };
}
