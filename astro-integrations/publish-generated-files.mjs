// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Adds the SSR sitemap to sitemap-index.xml and the SSR pages to llms.txt.
 * Register after sitemap() and llms(). The adapter serves whatever ends up on disk.
 *
 * @param {object} options
 * @param {string[]} options.sitemaps Root-relative sitemap routes for the index.
 * @param {{ path: string, title: string, description: string }[]} options.llmsPages
 *   SSR pages for llms.txt, filed under one heading above the generated sections.
 * @returns {import('astro').AstroIntegration}
 */
export function publishGeneratedFiles({ sitemaps, llmsPages }) {
  /** @type {import('astro').AstroConfig} */
  let config;

  return {
    name: 'publish-generated-files',
    hooks: {
      'astro:config:done': ({ config: resolved }) => {
        config = resolved;
      },
      'astro:build:done': async ({ dir, logger }) => {
        const site = config.site ?? 'https://mens-circle.de';
        const patch = async (/** @type {string} */ file, /** @type {(text: string) => string} */ edit) => {
          const path = fileURLToPath(new URL(file, dir));
          try {
            await writeFile(path, edit(await readFile(path, 'utf-8')));
          } catch {
            logger.warn(`${file} not found; left unpatched`);
          }
        };

        // No <lastmod>: these are regenerated per request.
        await patch('sitemap-index.xml', (index) =>
          index.replace(
            '</sitemapindex>',
            `${sitemaps.map((path) => `<sitemap><loc>${new URL(path, site).href}</loc></sitemap>`).join('')}</sitemapindex>`,
          ),
        );

        await patch('llms.txt', (text) => {
          const lines = llmsPages.map(
            ({ path, title, description }) => `- [${title}](${new URL(path, site).href}): ${description}`,
          );
          const block = `## Der Männerkreis\n\n${lines.join('\n')}\n`;
          const firstSection = text.indexOf('\n## ');
          return firstSection === -1
            ? `${text.trimEnd()}\n\n${block}`
            : `${text.slice(0, firstSection + 1)}${block}\n${text.slice(firstSection + 1)}`;
        });
      },
    },
  };
}
