/**
 * Verifies the built server over HTTP: the on-demand home page with its live content and
 * its photo through `/_image`, the prerendered pages with their build-time variants.
 * Images are decoded with Sharp, Astro's image service.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import sharp from 'sharp';

import { cacheControlForRoute } from '../src/lib/cache-policy';

const origin = new URL(process.argv[2] || 'http://127.0.0.1:18092');
const eventSlug = process.argv[3];
const images = new Map<string, number | undefined>();
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const attribute = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

const get = async (path: string) => {
  const response = await fetch(new URL(path.replaceAll('&amp;', '&'), origin));

  assert.equal(response.status, 200, path);

  return response;
};

for (const path of [
  '/',
  '/warum-ich-den-maennerkreis-leite',
  '/event',
  '/admin/login',
  ...(eventSlug ? [`/event/${eventSlug}`] : []),
]) {
  const response = await get(path);

  if (path === '/') assert.equal(response.headers.get('cache-control'), cacheControlForRoute('/'));

  const html = await response.text();

  // Only the on-demand home page names `/_image`; prerendered pages carry build-time files.
  if (path !== '/') assert.ok(!html.includes('/_image?'), path);

  for (const [tag] of html.matchAll(/<(?:img|source)\b[^>]*>/g)) {
    const src = attribute(tag, 'src');

    if (src?.startsWith('/')) images.set(src, images.get(src));

    for (const candidate of (attribute(tag, 'srcset') || '').split(',').filter(Boolean)) {
      const [url, descriptor] = candidate.trim().split(/\s+/);

      if (url.startsWith('/')) images.set(url, descriptor?.endsWith('w') ? Number.parseInt(descriptor) : undefined);
    }
  }

  if (path === '/') {
    // Live content is in the first HTML: no island, the next date in both summaries.
    assert.ok(!html.includes('/_server-islands/'), 'The home page has no server islands');
    assert.equal(html.match(/data-summary/g)?.length, 2, 'Both next-date summaries rendered');
  }

  if (eventSlug && path === `/event/${eventSlug}`) {
    assert.ok(
      html.includes('property="og:image" content="https://mens-circle.de/images/og-default.png"') ||
        /property="og:image" content="[^"]*\/images\/og-default.png(?:\?[^"]*)?"/.test(html),
    );
  }
}

// AVIF and WebP per crop and width, JPEG for the wide crop.
const isAvif = (path: string) => path.endsWith('.avif') || path.includes('f=avif');

assert.ok([...images.keys()].some(isAvif), 'AVIF variants missing');
assert.ok(images.size >= 20, 'Picture variants missing');
images.set('/images/og-default.png', 1200);

for (const [path, width] of images) {
  const response = await get(path);

  assert.match(response.headers.get('content-type') || '', /^image\//);
  const bytes = new Uint8Array(await response.arrayBuffer());
  // A full decode, not just the header.
  const { info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });

  // Sharp crops each variant, so it is exactly as wide as its `w` descriptor.
  if (width) assert.equal(info.width, width, path);

  if (path.startsWith('/_image')) continue;

  const changed = new Uint8Array(await (await get(`${path}?w=1&h=2&f=png&q=1`)).arrayBuffer());

  assert.equal(digest(changed), digest(bytes), 'Static bytes changed with parameters');
}

// `/_image` transforms the site's own files only: no remote source, no path out of dist/client.
for (const query of [
  '',
  '?href=https://example.invalid/source.jpg&w=700&f=webp',
  '?href=/missing.jpg&w=10&f=png',
  '?href=%2Fassets%2F..%2F..%2Fserver%2Fentry.mjs&w=10&f=webp',
  '?url=file:///etc/passwd&width=10',
]) {
  const response = await fetch(new URL(`/_image${query}`, origin));

  assert.ok(response.status >= 400, query);
  assert.ok(!(response.headers.get('content-type') || '').startsWith('image/'), query);
}

for (const slug of [eventSlug || 'unknown', 'missing-event']) {
  for (const query of ['', '?v=old&w=1&f=avif', '?href=https://example.invalid/new.png&q=1']) {
    const response = await fetch(new URL(`/event/${slug}/card.png${query}`, origin), { redirect: 'manual' });

    assert.equal(response.status, 404);
    assert.equal(response.headers.get('location'), null);
  }
}

console.log(
  `Production verification passed: ${images.size} images, the live home page, pages and refused image requests.`,
);
