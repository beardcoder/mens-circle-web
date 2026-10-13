// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Adds the SSR pages to llms.txt, which astro-llms-md builds from prerendered pages
 * only and has no option for. Register after llms(). The adapter serves whatever ends
 * up on disk. (The SSR sitemap goes into the index through sitemap's `customSitemaps`.)
 *
 * @param {object} options
 * @param {{ path: string, title: string, description: string }[]} options.llmsPages
 *   SSR pages for llms.txt, filed under one heading above the generated sections.
 * @returns {import('astro').AstroIntegration}
 */
export function publishGeneratedFiles({ llmsPages }) {
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
