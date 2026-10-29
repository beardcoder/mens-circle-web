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

  return html;
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
    const home = await readPage(origin, '/');
    const overview = await readPage(origin, '/event');

    assert.match(home, /1\. Januar 2099/);
    assert.match(home, /Eine freigegebene Erfahrung/);
    assert.match(home, /<details class="group\/quote"/);
    assert.match(overview, /data-state="full"/);
    assert.match(overview, /Auf die Warteliste/);
    assert.match(overview, /href="\/event\/testabend"/);

    const image = /<img[^>]+src="([^"]+)"/.exec(home)?.[1]?.replaceAll('&amp;', '&');

    assert(image, 'Home portrait should be rendered');
    assert.equal((await fetch(new URL(image, origin))).status, 200, 'SSR image transformation must work');

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
