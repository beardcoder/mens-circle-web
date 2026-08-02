// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Add sitemaps that are ROUTES, not build artefacts, to the generated
 * `sitemap-index.xml`.
 *
 * `@astrojs/sitemap` can only list what exists at build time. The event pages
 * don't: `/event/<slug>` is SSR and its slugs come from SQLite, so they are
 * published without a rebuild (see src/pages/sitemap-events.xml.ts). That
 * sitemap has to be generated per request — and then something has to tell
 * crawlers it exists, because robots.txt only points at the index.
 *
 * This integration appends a `<sitemap>` entry per configured path.
 *
 * ORDER MATTERS TWICE. Register it AFTER `sitemap()`, so the index file already
 * exists, and BEFORE `serveSitemapWithBunAdapter()`, which records each sitemap
 * file's byte length and ETag into the Bun adapter's static manifest — patching
 * the file afterwards would leave a stale `content-length` and serve a truncated
 * document. Astro runs `astro:build:done` hooks in integration-array order, so
 * sitting between the two is what keeps both invariants.
 *
 * @param {object} options
 * @param {string[]} options.paths Root-relative sitemap paths to add, e.g.
 *   `['/sitemap-events.xml']`.
 * @returns {import('astro').AstroIntegration}
 */
export function addSitemapsToIndex({ paths }) {
  /** @type {import('astro').AstroConfig | undefined} */
  let config;

  return {
    name: 'sitemap-index-extra',
    hooks: {
      'astro:config:done': ({ config: resolved }) => {
        config = resolved;
      },
      'astro:build:done': async ({ dir, logger }) => {
        if (!config || paths.length === 0) return;

        const indexPath = fileURLToPath(new URL('sitemap-index.xml', dir));

        let index;
        try {
          index = await readFile(indexPath, 'utf-8');
        } catch {
          // No index (sitemap() disabled or output shape changed) — nothing to do.
          logger.warn('sitemap-index.xml not found; dynamic sitemaps were not registered');
          return;
        }

        const closing = '</sitemapindex>';
        if (!index.includes(closing)) {
          logger.warn('sitemap-index.xml has an unexpected shape; leaving it untouched');
          return;
        }

        const added = [];
        let entries = '';
        for (const path of paths) {
          const loc = new URL(path, config.site ?? 'https://mens-circle.de').href;
          if (index.includes(`<loc>${loc}</loc>`)) continue; // already listed
          entries += `<sitemap><loc>${loc}</loc></sitemap>`;
          added.push(loc);
        }

        if (added.length === 0) return;

        // No <lastmod> on purpose: these sitemaps are regenerated per request, so
        // a build timestamp would claim a freshness date that means nothing.
        await writeFile(indexPath, index.replace(closing, `${entries}${closing}`));
        logger.info(`Added ${added.length} dynamic sitemap(s) to the index: ${added.join(', ')}`);
      },
    },
  };
}
