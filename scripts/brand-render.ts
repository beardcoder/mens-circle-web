/**
 * Renders the brand templates (src/components/print, listed in lib/brand/registry.ts)
 * to PDF and PNG in brand/out/:
 *
 *   bun run brand:render                       every template, dates from brand/data.example.json
 *   bun run brand:render --from-site https://mens-circle.de   the live coming dates
 *   bun run brand:render --data my-dates.json --only flyer-a6,ig-square
 *   bun run brand:render --only og-default,og-markus --install   and replace the preview images
 *
 * It builds the site once with the template pages switched on (`BRAND_TEMPLATES=1`)
 * into brand/.dist, serves that build's static files and prints each page in
 * Chromium (Playwright): PDFs at the trimmed size plus bleed with the fonts
 * embedded, PNGs at 300 dpi for print and at their pixel size for screens.
 */
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { chromium, type Page } from 'playwright';
import sharp from 'sharp';

import { type BrandData, brandData } from '../src/lib/brand/data';
import { pageSize, TEMPLATES, type TemplateSpec } from '../src/lib/brand/registry';

const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    data: { type: 'string' },
    'from-site': { type: 'string' },
    out: { type: 'string', default: 'brand/out' },
    install: { type: 'boolean', default: false },
  },
});

const root = resolve(import.meta.dir, '..');
const out = resolve(root, args.out!);
const dist = resolve(root, 'brand/.dist');
const wanted = args.only ? new Set(args.only.split(',')) : null;
const specs = TEMPLATES.filter((spec) => !wanted || wanted.has(spec.id));

if (specs.length === 0) throw new Error(`No template matches --only ${args.only}`);

interface PublicEvent {
  slug: string;
  isPast: boolean;
  view: {
    title: [string, string];
    datetime: string;
    facts: { time: string; place: string };
    seats: BrandData['events'][0]['seats'];
  };
}

/** The coming dates from the live site's public endpoints (no database needed). */
async function fromSite(origin: string): Promise<BrandData> {
  const sitemap = await (await fetch(new URL('/sitemap-events.xml', origin))).text();
  const slugs = [...sitemap.matchAll(/<loc>[^<]*\/event\/([^<]+)<\/loc>/g)].map((m) => m[1]);
  const events: BrandData['events'] = [];

  for (const slug of slugs) {
    const response = await fetch(new URL(`/api/public/events/${slug}`, origin));

    if (!response.ok) continue;

    const event = (await response.json()) as PublicEvent;

    if (event.isPast) continue;

    events.push({
      date: event.view.title.join(' ').replace(/,$/, ''),
      day: event.view.datetime,
      time: event.view.facts.time,
      place: event.view.facts.place,
      url: new URL(`/event/${event.slug}`, origin).href,
      seats: event.view.seats,
    });
  }

  events.sort((a, b) => a.day.localeCompare(b.day));

  return { events, datesUrl: new URL('/event', origin).href };
}

async function loadData(): Promise<BrandData> {
  if (args['from-site']) return brandData.parse(await fromSite(args['from-site']));

  const file = resolve(root, args.data ?? 'brand/data.example.json');

  return brandData.parse(JSON.parse(await readFile(file, 'utf8')));
}

function build(dataFile: string): void {
  console.info('Building the site with the brand templates …');
  const result = Bun.spawnSync(['bun', '--bun', 'astro', 'build', '--outDir', dist], {
    cwd: root,
    env: { ...process.env, BRAND_TEMPLATES: '1', BRAND_DATA: dataFile },
    stdout: 'ignore',
    stderr: 'pipe',
  });

  if (result.exitCode !== 0) throw new Error(`astro build failed:\n${result.stderr.toString()}`);
}

const TYPES: Record<string, string> = { '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' };

/** The build's static files, as the site would serve them. */
function serve(client: string) {
  return Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const path = decodeURIComponent(new URL(request.url).pathname);

      for (const candidate of [path, `${path}.html`, join(path, 'index.html')]) {
        const file = Bun.file(join(client, candidate));

        if (candidate.endsWith('/') || !(await file.exists())) continue;

        return new Response(file, { headers: { 'Content-Type': TYPES[extname(candidate)] ?? file.type } });
      }

      return new Response('Not found', { status: 404 });
    },
  });
}

/** CSS pixels of a template's full size (bleed included). */
const pixels = (spec: TemplateSpec): { width: number; height: number } => {
  const toPx = (n: number) => (spec.unit === 'mm' ? Math.round((n * 96) / 25.4) : n);

  return { width: toPx(spec.width + 2 * spec.bleed), height: toPx(spec.height + 2 * spec.bleed) };
};

/** A screen template is exactly its pixel size (a preview image of 1200 × 630, a post of 1080 × 1080). */
async function assertSize(file: string, spec: TemplateSpec): Promise<void> {
  if (spec.unit !== 'px') return;

  const { width, height } = await sharp(file).metadata();

  if (width !== spec.width || height !== spec.height) {
    throw new Error(`${file} is ${width} × ${height}, not ${spec.width} × ${spec.height}`);
  }
}

async function render(page: Page, origin: string, spec: TemplateSpec): Promise<string[]> {
  await page.setViewportSize(pixels(spec));
  await page.goto(`${origin}/brand/${spec.id}`, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
  });

  const written: string[] = [];

  if (spec.outputs.includes('pdf')) {
    const file = join(out, `${spec.id}.pdf`);

    await page.pdf({ path: file, ...pageSize(spec), printBackground: true });
    written.push(file);
  }

  if (spec.outputs.includes('png')) {
    const sheets = page.locator('[data-sheet]');
    const count = await sheets.count();

    for (let i = 0; i < count; i += 1) {
      const file = join(out, count > 1 ? `${spec.id}-${i + 1}.png` : `${spec.id}.png`);

      await sheets.nth(i).screenshot({ path: file, omitBackground: spec.transparent ?? false });
      await assertSize(file, spec);
      written.push(file);
    }
  }

  return written;
}

/** The preview images the site serves, replaced by their rendered versions. */
async function install(): Promise<void> {
  for (const id of ['og-default', 'og-markus']) {
    if (!specs.some((spec) => spec.id === id)) continue;

    await copyFile(join(out, `${id}.png`), join(root, 'public/images', `${id}.png`));
    console.info(`public/images/${id}.png (bump its ?v= where it is referenced)`);
  }
}

const data = await loadData();
const dataFile = join(out, 'data.json');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await writeFile(dataFile, `${JSON.stringify(data, null, 2)}\n`);
build(dataFile);

const server = serve(join(dist, 'client'));
const browser = await chromium.launch();

try {
  for (const spec of specs) {
    const isPrint = spec.unit === 'mm';
    const context = await browser.newContext({ deviceScaleFactor: isPrint ? 300 / 96 : 1 });
    const page = await context.newPage();

    for (const file of await render(page, `http://127.0.0.1:${server.port}`, spec))
      console.info(file.replace(`${root}/`, ''));

    await context.close();
  }
} finally {
  await browser.close();
  await server.stop(true);
}

if (args.install) await install();
