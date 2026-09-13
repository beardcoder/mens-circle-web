// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Add SSR pages to `llms.txt`.
 *
 * `astro-llms-md` derives its index from the HTML on disk after the build, which
 * is exactly why it cannot drift — and exactly why it misses everything that is
 * server-rendered. Here that is the two pages that matter most: `/` (the circle
 * itself) and `/event` (the dates). Both are SSR because they state the live
 * scheduling status, so neither exists as a file at build time and neither was
 * listed. The index an LLM read therefore opened with the breathing exercise and
 * the privacy policy, and never mentioned what the Männerkreis is.
 *
 * These entries link the HTML URLs rather than `.md` companions: there is no
 * prerendered markdown to point at, and llms.txt makes no requirement that a
 * link be markdown.
 *
 * ORDER MATTERS TWICE, exactly as for the sitemap: after `llms()`, so the file
 * exists, and before `serveLlmsWithBunAdapter()`, which records each file's byte
 * length into the adapter manifest — patching afterwards would serve a truncated
 * document.
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
          // No llms.txt (integration disabled or renamed) — nothing to patch.
          logger.warn('llms.txt not found; SSR pages were not added');
          return;
        }

        const site = config.site ?? 'https://mens-circle.de';
        const lines = [];
        for (const entry of entries) {
          const href = new URL(entry.path, site).href;
          if (text.includes(`(${href})`)) continue; // already listed
          lines.push(`- [${entry.title}](${href}): ${entry.description}`);
        }

        if (lines.length === 0) return;

        // Prepended above the generated sections: these are the pages a model
        // should read first, and llms.txt is read top-down.
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
