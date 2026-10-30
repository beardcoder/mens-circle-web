/** Production HTML regression checks. Run after build; all data lives in a disposable database. */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sandbox = await mkdtemp(join(tmpdir(), 'mens-circle-pages-'));

process.env.DATABASE_PATH = join(sandbox, 'pages.sqlite');

const { db } = await import('../src/lib/server/db');
const { events, testimonials } = await import('../src/lib/server/db/schema');

async function withServer(check: (origin: string) => Promise<void>): Promise<void> {
  const reservation = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() });
  const port = reservation.port!;

  await reservation.stop(true);

  const child = Bun.spawn([process.execPath, '--no-env-file', 'dist/server/entry.mjs'], {
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_PATH: process.env.DATABASE_PATH,
    },
    stdout: 'ignore',
    stderr: 'pipe',
  });

  const errors = new Response(child.stderr).text();
  const origin = `http://127.0.0.1:${port}`;

  try {
    let ready = false;

    for (let attempt = 0; attempt < 100; attempt++) {
      if (
        await fetch(`${origin}/favicon.svg`)
          .then((r) => r.ok)
          .catch(() => false)
      ) {
        ready = true;
        break;
      }

      if (child.exitCode !== null) throw new Error(await errors);

      await Bun.sleep(50);
    }

    assert(ready, 'Production server did not start');
    await check(origin);
  } finally {
    child.kill();
    await child.exited;
    await errors;
  }
}

async function readPage(origin: string, path: string, status = 200): Promise<string> {
  const response = await fetch(`${origin}${path}`);
  const html = await response.text();

  assert.equal(response.status, status, `${path}: expected ${status}`);

  if (status === 503) assert.equal(response.headers.has('X-Astro-Cache'), false);

  assert.match(response.headers.get('cache-control') ?? '', status === 503 ? /no-store/ : /must-revalidate/);
  assert(!html.includes('<astro-island'), `${path}: public content must not hydrate`);
  assert(!html.includes('as="fetch"'), `${path}: no client data preload`);
  assert(!html.includes('PRIVATE'), `${path}: unpublished data must stay private`);
  assert.match(html, /rel="stylesheet"/, 'Shared CSS should be cacheable');
  assert.match(html, /<script type="speculationrules">/, `${path}: prefetch through speculation rules`);
  assert(!/<script[^>]+src="[^"]*\/page\.[^"]+\.js"/.test(html), `${path}: no prefetch script`);

  return html;
}

/** The portrait and the stylesheet are hashed build files; nothing is transformed on request. */
async function checkAssets(origin: string, home: string): Promise<void> {
  const image = /<img[^>]+src="([^"]+)"/.exec(home)?.[1] ?? '';

  assert(image.startsWith('/assets/'), 'Home portrait must be a build asset, not /_image');
  const portrait = await fetch(new URL(image, origin));

  assert.equal(portrait.status, 200);
  assert.match(portrait.headers.get('cache-control') ?? '', /immutable/);
  await portrait.arrayBuffer();
  assert(!home.includes('/_image'), 'SSR pages must not use the on-demand image endpoint');
  assert.equal((await fetch(`${origin}/_image?href=${encodeURIComponent(image)}&w=300&f=webp`)).status, 404);

  const css =
    /rel="stylesheet"[^>]*href="([^"]+)"/.exec(home)?.[1] ?? /href="([^"]+)"[^>]*rel="stylesheet"/.exec(home)?.[1];

  assert(css, 'Shared CSS must be present');
  const asset = await fetch(new URL(css, origin));

  assert.match(asset.headers.get('cache-control') ?? '', /max-age=31536000.*immutable/);
  await asset.arrayBuffer();
  const etag = asset.headers.get('etag');

  assert(etag, 'Node static server should provide ETags');
  assert.equal((await fetch(new URL(css, origin), { headers: { 'If-None-Match': etag } })).status, 304);
}

try {
  await withServer(async (origin) => {
    for (const path of ['/', '/event']) {
      const html = await readPage(origin, path);

      assert.match(html, /Der nächste Abend ist in Planung/);
      assert.match(html, /Über neue Termine informieren/);
    }
  });

  await db.insert(events).values([
    {
      id: 'open',
      title: 'Männerkreis',
      slug: 'testabend',
      eventDate: '2099-01-01T12:00:00.000Z',
      city: 'Straubing',
      isPublished: true,
    },
    {
      id: 'full',
      title: 'Männerkreis',
      slug: 'voll',
      eventDate: '2099-02-01T12:00:00.000Z',
      maxParticipants: 0,
      isPublished: true,
    },
    { id: 'draft', title: 'PRIVATE EVENT', slug: 'private', eventDate: '2099-03-01T12:00:00.000Z' },
  ]);
  await db.insert(testimonials).values([
    {
      id: 'approved',
      quote: 'Eine freigegebene Erfahrung.',
      authorName: 'Testteilnehmer',
      email: 'PRIVATE EMAIL',
      isPublished: true,
    },
    { id: 'long', quote: 'Eine längere Erfahrung. '.repeat(25), isPublished: true },
    { id: 'hidden', quote: 'PRIVATE QUOTE' },
  ]);

  await withServer(async (origin) => {
    const first = await fetch(origin);

    assert.equal(first.headers.get('X-Astro-Cache'), 'MISS');
    await first.text();
    const cached = await fetch(origin);

    assert.equal(cached.headers.get('X-Astro-Cache'), 'HIT');
    await cached.text();
    const personalized = await fetch(origin, { headers: { Cookie: 'test=1' } });

    assert.equal(personalized.headers.get('X-Astro-Cache'), 'HIT');
    await personalized.text();
    const queried = await fetch(`${origin}/?nocache=${Date.now()}`);

    assert.equal(queried.headers.get('X-Astro-Cache'), 'HIT', 'A query string must not bypass or fragment the cache');
    await queried.text();
    const home = await readPage(origin, '/');
    const overview = await readPage(origin, '/event');

    assert.match(home, /1\. Januar 2099/);
    assert.match(home, /Eine freigegebene Erfahrung/);
    assert.match(home, /<details class="group\/quote"/);
    assert.match(overview, /data-state="full"/);
    assert.match(overview, /Auf die Warteliste/);
    assert.match(overview, /href="\/event\/testabend"/);

    await checkAssets(origin, home);

    const json = await fetch(`${origin}/api/public/events/testabend`);

    assert.equal(json.status, 200);
    assert.equal(json.headers.get('X-Astro-Cache'), 'MISS');
    assert.equal((await json.json()).availableSpots, 8);
    assert.equal((await fetch(`${origin}/api/public/events/testabend`)).headers.get('X-Astro-Cache'), 'HIT');
    const missing = await fetch(`${origin}/api/public/events/private`);

    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('cache-control'), 'no-store');
    assert.equal((await fetch(`${origin}/api/public/events`)).status, 404);

    for (const font of ['fraunces-500.woff2', 'figtree.woff2', 'dm-sans.woff2', 'playfair-display-400.woff2']) {
      const response = await fetch(`${origin}/fonts/mail/${font}`, { headers: { Origin: 'https://listmonk.example' } });

      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
      assert.equal(response.headers.get('Content-Type'), 'font/woff2');
      assert((await response.arrayBuffer()).byteLength > 1000);
    }

    assert.equal((await fetch(`${origin}/fonts/mail/not-a-font.woff2`)).status, 404);
    assert.equal((await fetch(`${origin}/health`, { method: 'HEAD' })).status, 200);
    const admin = await fetch(`${origin}/admin`, { redirect: 'manual' });

    assert.equal(admin.status, 302);
    assert.match(admin.headers.get('location') ?? '', /admin\/login/);
    assert.equal(admin.headers.get('cache-control'), 'private, no-store');

    for (const path of ['/admin/events', '/admin/events/open/registrations', '/admin/testimonials']) {
      const page = await fetch(`${origin}${path}`, { redirect: 'manual' });

      assert.equal(page.status, 302, `${path} must require a session`);
      assert.match(page.headers.get('location') ?? '', /admin\/login/);
    }

    const retired = await fetch(`${origin}/atemuebung`, { redirect: 'manual' });

    assert.equal(retired.status, 301);
    assert.equal(new URL(retired.headers.get('location') ?? '', origin).pathname, '/');
    const crossSite = await fetch(`${origin}/_actions/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: 'https://evil.example',
        'Sec-Fetch-Site': 'cross-site',
      },
      body: '',
    });

    assert.equal(crossSite.status, 403);
    const sameSite = await fetch(`${origin}/_actions/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: origin, 'Sec-Fetch-Site': 'same-origin' },
      body: '',
    });

    assert.equal(sameSite.status, 400, 'Same-site Action POST must reach input validation');
    const redirect = await fetch(`${origin}/events`, { redirect: 'manual' });

    assert([301, 302, 308].includes(redirect.status));
    assert.match(redirect.headers.get('location') ?? '', /\/event$/);

    const sitemap = await fetch(`${origin}/sitemap-0.xml`).then((r) => r.text());

    const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);

    assert(paths.includes('/'));
    assert(paths.includes('/event'));
    console.info(
      `Public HTML: home ${Buffer.byteLength(home)} bytes, overview ${Buffer.byteLength(overview)} bytes; zero hydrated islands.`,
    );
  });

  // A malformed disposable database exercises unavailable-data states on a fresh server/cache.
  db.$client.run('DROP TABLE testimonials');

  await withServer(async (origin) => {
    const response = await fetch(origin);
    const html = await response.text();

    assert.equal(response.status, 200, 'A failed quote read must not hide available events');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(html, /1\. Januar 2099/);
    assert.match(html, /Die Erfahrungen lassen sich gerade nicht laden/);
  });

  db.$client.run('ALTER TABLE events RENAME TO unavailable_events');

  await withServer(async (origin) => {
    for (const path of ['/', '/event']) {
      const html = await readPage(origin, path, 503);

      assert.match(html, /Die Termine sind gerade nicht abrufbar/);
      assert.match(html, /Seite erneut laden/);
      assert(!html.includes('Der nächste Abend ist in Planung'));
    }
  });

  console.info('Public page checks passed: empty, scheduled, full, private, unavailable, images and sitemap.');
} finally {
  db.$client.close();
  await rm(sandbox, { recursive: true, force: true });
}
