// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Add SSR pages to `llms.txt`. `astro-llms-md` derives its index from the HTML
 * on disk after the build, so it misses everything server-rendered. The entries
 * link HTML URLs: there is no prerendered markdown to point at.
 *
 * ORDER MATTERS TWICE, as for the sitemap: after `llms()`, so the file exists,
 * and before `serveLlmsWithBunAdapter()`, which records each file's byte length
 * into the adapter manifest — patching afterwards serves a truncated document.
 *
 * @param {object} options
 * @param {{ path: string, title: string, description: string }[]} options.entries
 *   Pages to add, in the order they should appear.
 * @param {string} [options.heading] Section heading to file them under.
 * @returns {import('astro').AstroIntegration}
 */
export function addPagesToLlmsTxt({ entries, heading = 'Der Männerkreis' }) {
  /** @type {import('astro').AstroConfig | undefined} */
  let config;

  return {
    name: 'llms-extra',
    hooks: {
      'astro:config:done': ({ config: resolved }) => {
        config = resolved;
      },
      'astro:build:done': async ({ dir, logger }) => {
        if (!config || entries.length === 0) return;

        const filePath = fileURLToPath(new URL('llms.txt', dir));

        let text;
        try {
          text = await readFile(filePath, 'utf-8');
        } catch {
          logger.warn('llms.txt not found; SSR pages were not added');
          return;
        }

        const site = config.site ?? 'https://mens-circle.de';
        const lines = [];
        for (const entry of entries) {
          const href = new URL(entry.path, site).href;
          if (text.includes(`(${href})`)) continue;
          lines.push(`- [${entry.title}](${href}): ${entry.description}`);
        }

        if (lines.length === 0) return;

        // llms.txt is read top-down, so these go above the generated sections.
        const block = `## ${heading}\n\n${lines.join('\n')}\n`;
        const firstSection = text.indexOf('\n## ');
        const patched =
          firstSection === -1
            ? `${text.trimEnd()}\n\n${block}`
            : `${text.slice(0, firstSection + 1)}${block}\n${text.slice(firstSection + 1)}`;

        await writeFile(filePath, patched);
        logger.info(`Added ${lines.length} SSR page(s) to llms.txt`);
      },
    },
  };
}
