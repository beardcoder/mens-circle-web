import assert from 'node:assert/strict';

import { db } from '../src/lib/server/db';
import { events, testimonials } from '../src/lib/server/db/schema';
import { PUBLIC_CACHE, readPublicEvents, readPublicTestimonials } from '../src/lib/server/public-data';
import { GET as eventEndpoint } from '../src/pages/api/public/events/[slug]';

await db.insert(events).values([
  {
    id: 'open',
    title: 'Offener Testabend',
    slug: 'testabend',
    eventDate: '2099-01-01T12:00:00.000Z',
    city: 'Teststadt',
    street: 'PRIVATE STREET',
    locationDetails: 'PRIVATE DETAILS',
    isPublished: true,
    maxParticipants: 8,
  },
  {
    id: 'unicode',
    title: 'Vergangener Abend',
    slug: 'abend-im-märz',
    eventDate: '2020-01-01T12:00:00.000Z',
    isPublished: true,
  },
  { id: 'draft', title: 'PRIVATE DRAFT', slug: 'entwurf', eventDate: '2099-01-02T12:00:00.000Z', isPublished: false },
]);
await db.insert(testimonials).values([
  {
    id: 'approved',
    quote: 'Eine freigegebene Erfahrung.',
    authorName: 'Testname',
    email: 'PRIVATE EMAIL',
    isPublished: true,
  },
  { id: 'hidden', quote: 'PRIVATE QUOTE', isPublished: false },
  { id: 'deleted', quote: 'DELETED QUOTE', isPublished: true, deleted: new Date().toISOString() },
]);

/** Calls the JSON route as Astro would and records what it asked the route cache for. */
const readEndpoint = async (slug: string) => {
  const cached: unknown[] = [];

  const response = await eventEndpoint({
    cache: { set: (options: unknown) => cached.push(options) },
    request: new Request(`http://localhost/api/public/events/${encodeURIComponent(slug)}`),
    params: { slug },
  } as unknown as Parameters<typeof eventEndpoint>[0]);

  return { response, cached };
};

const list = await readPublicEvents();

assert(list);
assert.equal(list.status, 'scheduled');
assert.equal(list.events.length, 1);
assert.equal(list.events[0].availableSpots, 8);
assert.equal(list.next?.place, 'Teststadt');
assert.equal(JSON.stringify(list).includes('PRIVATE'), false);

const open = await readEndpoint('testabend');
const single = await open.response.json();

assert.equal(open.response.status, 200);
assert.deepEqual(open.cached, [PUBLIC_CACHE]);
assert.equal(open.response.headers.has('Set-Cookie'), false);
assert.equal(single.view.state, 'open');
assert.equal(JSON.stringify(single).includes('PRIVATE'), false);

const unicode = await readEndpoint('abend-im-märz');

assert.equal(unicode.response.status, 200);
assert.equal((await unicode.response.json()).slug, 'abend-im-märz');

for (const slug of ['entwurf', 'missing', '']) {
  const { response, cached } = await readEndpoint(slug);

  assert.equal(response.status, 404, slug);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(cached, [], 'a miss is never stored');
}

const voices = await readPublicTestimonials();

assert(voices);
assert.equal(voices.length, 1);
assert.equal(JSON.stringify(voices).includes('PRIVATE'), false);
assert.equal(JSON.stringify(voices).includes('DELETED'), false);

await db.delete(events);
assert.equal((await readPublicEvents())?.status, 'none');

// A database failure is a retriable 503, never a stored empty list.
db.run('DROP TABLE events');
assert.equal(await readPublicEvents(), null);
const failed = await readEndpoint('testabend');

assert.equal(failed.response.status, 503);
assert.equal(failed.response.headers.get('Cache-Control'), 'no-store');
assert.deepEqual(failed.cached, []);
assert.equal((await failed.response.json()).message, 'Der Termin ist gerade nicht abrufbar.');
