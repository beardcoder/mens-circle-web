import assert from 'node:assert/strict';

import { db } from '../src/lib/server/db';
import { events, testimonials } from '../src/lib/server/db/schema';
import {
  publicEvent,
  publicJson,
  readPublicEvent,
  readPublicEvents,
  readPublicTestimonials,
} from '../src/lib/server/public-data';
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

const list = await readPublicEvents();

assert.equal(list.status, 'scheduled');
assert.equal(list.events.length, 1);
assert.equal(list.events[0].availableSpots, 8);
assert.equal(list.next?.place, 'Teststadt');
assert.equal(JSON.stringify(list).includes('PRIVATE'), false);
const single = publicEvent(await readPublicEvent('testabend'));

assert.equal(single.view.state, 'open');
const unicodeResponse = await eventEndpoint({
  cache: { set() {} },
  request: new Request('http://localhost/api/public/events/abend-im-m%C3%A4rz'),
  params: { slug: 'abend-im-märz' },
} as unknown as Parameters<typeof eventEndpoint>[0]);

assert.equal(unicodeResponse.status, 200);
assert.equal((await unicodeResponse.json()).slug, 'abend-im-märz');
assert.equal(JSON.stringify(single).includes('PRIVATE'), false);
const voices = await readPublicTestimonials();

assert.equal(voices.testimonials.length, 1);
assert.equal(JSON.stringify(voices).includes('PRIVATE'), false);
assert.equal(JSON.stringify(voices).includes('DELETED'), false);
const request = new Request('http://localhost/api/public/events');
const response = await publicJson(request, readPublicEvents);

assert.equal(response.status, 200);
assert.equal(response.headers.get('Cache-Control'), 'public, max-age=0, must-revalidate');
assert.equal(response.headers.has('Set-Cookie'), false);
const etag = response.headers.get('ETag')!;

const conditional = await publicJson(new Request(request, { headers: { 'If-None-Match': etag } }), readPublicEvents);

assert.equal(conditional.status, 304);
assert.equal(await conditional.text(), '');
assert.equal((await publicJson(request, () => readPublicEvent('entwurf'))).status, 404);
assert.equal((await publicJson(request, () => readPublicEvent('missing'))).status, 404);

await db.delete(events);
assert.equal((await readPublicEvents()).status, 'none');

// A database failure is a retriable 503, never a cached empty successful list.
db.run('DROP TABLE events');
const failed = await publicJson(request, readPublicEvents);

assert.equal(failed.status, 503);
assert.equal(failed.headers.get('Cache-Control'), 'no-store');
assert.equal((await failed.json()).message, 'Die Termine sind gerade nicht abrufbar.');
