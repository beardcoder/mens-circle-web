// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cacheControlForFile } from '../src/lib/cache-policy.ts';

/**
 * Writes src/lib/cache-policy.ts into the adapter's static manifest for non-HTML files.
 * Register last, after publish-generated-files.
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
