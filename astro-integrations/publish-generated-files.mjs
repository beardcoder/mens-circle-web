// @ts-check
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Finishes what `@astrojs/sitemap` and `astro-llms-md` write at build time, and
 * publishes it under `@wyattjoh/astro-bun-adapter`.
 *
 * 1. `sitemap-index.xml` gains the sitemaps that are routes, not files — the
 *    event slugs live in SQLite (src/pages/sitemap-events.xml.ts).
 * 2. `llms.txt` gains the SSR pages, which `astro-llms-md` cannot see because it
 *    reads the built HTML.
 * 3. Every generated file is registered in the adapter's `static-manifest.json`.
 *    The adapter writes that manifest in its own `astro:build:done`, which Astro
 *    runs first, so anything generated later would 404 in production.
 *
 * Register it AFTER `sitemap()` and `llms()`. The patches must land before the
 * manifest records each file's byte length, which is why all three steps live
 * in this one hook.
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

        const manifestPath = fileURLToPath(new URL('.astro-bun-adapter/static-manifest.json', config.build.server));
        /** @type {Record<string, { headers: Record<string, string>; filePath: string }>} */
        let manifest;
        try {
          manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
        } catch {
          return;
        }

        const generated = (await readdir(fileURLToPath(dir))).filter(
          (file) => /^sitemap.*\.xml$/.test(file) || /^llms(-full)?\.txt$/.test(file) || file.endsWith('.md'),
        );
        for (const file of generated) {
          const content = await readFile(new URL(file, dir));
          manifest[`/${file}`] = {
            headers: {
              'content-type': file.endsWith('.xml')
                ? 'application/xml'
                : file.endsWith('.md')
                  ? 'text/markdown; charset=utf-8'
                  : 'text/plain; charset=utf-8',
              'content-length': String(content.byteLength),
              'cache-control': 'public, max-age=3600, must-revalidate',
              etag: `"${createHash('sha256').update(content).digest('hex').slice(0, 16)}"`,
            },
            filePath: file,
          };
        }
        await writeFile(manifestPath, JSON.stringify(manifest));
        logger.info(`Registered ${generated.length} generated file(s) with the Bun adapter`);
      },
    },
  };
}
