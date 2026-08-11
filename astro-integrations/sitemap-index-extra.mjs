// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Add sitemaps that are ROUTES, not build artefacts, to `sitemap-index.xml`.
 *
 * `@astrojs/sitemap` can only list what exists at build time, and `/event/<slug>`
 * does not: it is SSR off SQLite slugs. src/pages/sitemap-events.xml.ts covers
 * those per request, and this appends a `<sitemap>` entry pointing at it, since
 * robots.txt only advertises the index.
 *
 * ORDER MATTERS TWICE: after `sitemap()`, so the index exists, and before
 * `serveSitemapWithBunAdapter()`, which records each file's byte length into the
 * adapter manifest — patching afterwards would serve a truncated document.
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
