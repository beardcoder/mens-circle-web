// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cacheControlForFile } from '../src/lib/cache-policy.ts';

/**
 * Applies the site's cache policy to the files the Bun adapter serves from
 * disk.
 *
 * The adapter has one knob for every unhashed file (`staticCacheControl`,
 * default `public, max-age=86400, must-revalidate`), and that one value has to
 * cover things with nothing in common: prerendered HTML, the favicons, the OG
 * poster, `robots.txt` and the service worker that exists to unregister
 * itself. A day was too long for the first and the last, and far too short for
 * the rest. src/lib/cache-policy.ts decides per path instead; this hook writes
 * the answer into the manifest.
 *
 * HTML is deliberately not touched here. Those entries carry whatever
 * `Astro.response.headers` held when the page was prerendered, which
 * src/middleware.ts fills from the same table — one policy, one file, two
 * places that read it.
 *
 * Register it LAST: the adapter writes the manifest in its own
 * `astro:build:done`, and publish-generated-files.mjs adds the sitemaps and
 * `llms.txt` to it afterwards.
 *
 * @returns {import('astro').AstroIntegration}
 */
export function staticCacheHeaders() {
  /** @type {import('astro').AstroConfig} */
  let config;

  return {
    name: 'static-cache-headers',
    hooks: {
      'astro:config:done': ({ config: resolved }) => {
        config = resolved;
      },
      'astro:build:done': async ({ logger }) => {
        const manifestPath = fileURLToPath(new URL('.astro-bun-adapter/static-manifest.json', config.build.server));
        /** @type {Record<string, { headers: Record<string, string>; filePath: string }>} */
        let manifest;
        try {
          manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
        } catch {
          logger.warn('static manifest not found; cache policy left unapplied');
          return;
        }

        let applied = 0;
        for (const [pathname, entry] of Object.entries(manifest)) {
          const value = cacheControlForFile(pathname, config.build.assets);
          if (!value) continue;
          // Lowercase, like every other key the adapter and its siblings write.
          entry.headers['cache-control'] = value;
          applied++;
        }

        await writeFile(manifestPath, JSON.stringify(manifest));
        logger.info(`Applied the cache policy to ${applied} static file(s)`);
      },
    },
  };
}
