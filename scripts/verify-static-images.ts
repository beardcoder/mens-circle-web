/** Verifies the built server over HTTP. Sharp runs only in this separate test process. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

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
  '/atemuebung',
  '/admin/login',
  ...(eventSlug ? [`/event/${eventSlug}`] : []),
]) {
  const response = await get(path);
  if (path === '/') assert.equal(response.headers.get('cache-control'), 'no-cache');
  const html = await response.text();
  assert.ok(!html.includes('/_image?'), path);
  for (const [tag] of html.matchAll(/<(?:img|source)\b[^>]*>/g)) {
    const src = attribute(tag, 'src');
    if (src?.startsWith('/')) images.set(src, images.get(src));
    for (const candidate of (attribute(tag, 'srcset') || '').split(',').filter(Boolean)) {
      const [url, descriptor] = candidate.trim().split(/\s+/);
      if (url.startsWith('/')) images.set(url, descriptor?.endsWith('w') ? Number.parseInt(descriptor) : undefined);
    }
  }
  if (path === '/') {
    const islands = [
      ...html.matchAll(/let response = await fetch\("([^"\n]+\/_server-islands\/[^"\n]+|\/_server-islands\/[^"\n]+)"/g),
    ];
    assert.equal(islands.length, 4, 'Expected four native server islands');
    for (const [, url] of islands) {
      const fragment = await (await get(url)).text();
      assert.ok(!fragment.includes('data-status="loading"'), 'Island must resolve live state');
      assert.ok(!fragment.includes('/_image?'));
    }
  }
  if (eventSlug && path === `/event/${eventSlug}`) {
    assert.ok(
      html.includes('property="og:image" content="https://mens-circle.de/images/og-default.png"') ||
        /property="og:image" content="[^"]*\/images\/og-default.png"/.test(html),
    );
  }
}
assert.ok(images.size >= 16, 'Native Picture variants missing');
images.set('/images/og-default.png', 1200);
for (const [path, width] of images) {
  const response = await get(path);
  assert.match(response.headers.get('content-type') || '', /^image\//);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const metadata = await sharp(bytes).metadata();
  await sharp(bytes).raw().toBuffer();
  if (width) assert.equal(metadata.width, width, path);
  const changed = new Uint8Array(await (await get(`${path}?w=1&h=2&f=png&q=1`)).arrayBuffer());
  assert.equal(digest(changed), digest(bytes), 'Static bytes changed with parameters');
}

for (const query of [
  '',
  '?href=/images/og-default.png&w=1&h=9999&f=avif&q=1',
  '?href=https://example.invalid/source.jpg&w=700&f=webp',
  '?href=/missing.jpg&w=0&f=png',
  '?url=file:///etc/passwd&width=10',
]) {
  for (const method of ['GET', 'HEAD', 'POST']) {
    const response = await fetch(new URL(`/_image${query}`, origin), {
      method,
      headers: { origin: origin.origin, 'content-type': 'application/json' },
    });
    assert.equal(response.status, 410, `${method} ${query}`);
    assert.ok(!(response.headers.get('content-type') || '').startsWith('image/'));
  }
}
for (const slug of [eventSlug || 'unknown', 'missing-event']) {
  for (const query of ['', '?v=old&w=1&f=avif', '?href=https://example.invalid/new.png&q=1']) {
    const response = await fetch(new URL(`/event/${slug}/card.png${query}`, origin), { redirect: 'manual' });
    assert.equal(response.status, 301);
    assert.equal(new URL(response.headers.get('location')!).pathname, '/images/og-default.png');
  }
}
console.log(
  `Production verification passed: ${images.size} static images, native server islands, pages and legacy endpoints.`,
);
