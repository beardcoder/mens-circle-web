import assert from 'node:assert/strict';
import { mock } from 'bun:test';

import { createSession } from '../src/lib/server/auth';
import { db } from '../src/lib/server/db';
import { events, participants, registrations, testimonials } from '../src/lib/server/db/schema';
import { getEventById } from '../src/lib/server/events';

// Mock only Astro's virtual transport; execute the real handlers, session checks
// and SQLite queries. This fixture has its own process/module cache.
mock.module('astro:actions', () => ({
  defineAction: (options: { handler: unknown }) => options.handler,
  ActionError: class extends Error {
    code: string;
    constructor(options: { code: string; message: string }) {
      super(options.message);
      this.code = options.code;
    }
  },
}));

const { admin } = await import('../src/actions/admin');
const { events: eventActions } = await import('../src/actions/events');
const token = await createSession('admin@example.invalid');
const context = (value?: string) => ({ cookies: { get: () => (value ? { value } : undefined) } });

const invoke = (action: unknown, input: unknown, value?: string) =>
  (action as (input: unknown, context: unknown) => Promise<unknown>)(input, context(value));

const code = (expected: string) => (error: unknown) => (error as { code?: string }).code === expected;

for (const value of [undefined, 'invalid.session']) {
  await assert.rejects(invoke(admin.loadAdminOverview, undefined, value), code('UNAUTHORIZED'));
  await assert.rejects(invoke(admin.loadAdminRegistrations, { eventId: 'event' }, value), code('UNAUTHORIZED'));
  await assert.rejects(invoke(admin.loadAdminTestimonials, undefined, value), code('UNAUTHORIZED'));
  await assert.rejects(
    invoke(eventActions.setEventPublished, { id: 'event', published: true }, value),
    code('UNAUTHORIZED'),
  );
}

await db.insert(events).values([
  {
    id: 'event',
    title: 'Privater Entwurf',
    slug: 'test',
    eventDate: '2099-01-01T00:00:00.000Z',
    isPublished: false,
    maxParticipants: 1,
    street: 'PRIVATE STREET',
  },
  { id: 'deleted', title: 'Gelöscht', slug: 'deleted', eventDate: '2099-01-02T00:00:00.000Z', deleted: '2026-01-01' },
]);
await db
  .insert(participants)
  .values({ id: 'person', firstName: 'Test', lastName: 'Person', email: 'private@example.invalid' });
await db
  .insert(registrations)
  .values({ id: 'registration', eventId: 'event', participantId: 'person', status: 'registered' });
await db.insert(testimonials).values([
  {
    id: 'pending',
    quote: 'Eine private Einreichung zur Prüfung.',
    email: 'review@example.invalid',
    isPublished: false,
  },
  { id: 'removed', quote: 'Nicht mehr sichtbar.', isPublished: false, deleted: '2026-01-01' },
]);

const overview = (await invoke(admin.loadAdminOverview, undefined, token)) as {
  events: { id: string; activeCount: number }[];
  nextEventId: string;
  people: { email: string }[];
};

assert.equal(overview.events.length, 1);
assert.equal(overview.events[0].activeCount, 1);
assert.equal(overview.nextEventId, 'event');
assert.equal(overview.people[0].email, 'private@example.invalid');
assert.equal(JSON.stringify(overview.events).includes('PRIVATE STREET'), false);
const registrationsData = (await invoke(admin.loadAdminRegistrations, { eventId: 'event' }, token)) as {
  registrations: { id: string }[];
  maxParticipants: number;
};

assert.equal(registrationsData.registrations[0].id, 'registration');
assert.equal(registrationsData.maxParticipants, 1);
await assert.rejects(invoke(admin.loadAdminRegistrations, { eventId: 'deleted' }, token), code('NOT_FOUND'));
await assert.rejects(invoke(admin.loadAdminRegistrations, { eventId: 'missing' }, token), code('NOT_FOUND'));
const moderation = (await invoke(admin.loadAdminTestimonials, undefined, token)) as {
  testimonials: { id: string; email: string }[];
};

assert.equal(moderation.testimonials.length, 1);
assert.equal(moderation.testimonials[0].id, 'pending');
assert.equal(moderation.testimonials[0].email, 'review@example.invalid');
await invoke(eventActions.setEventPublished, { id: 'event', published: true }, token);
const published = await getEventById('event');

assert.equal(published?.isPublished, true);
assert.equal(published?.title, 'Privater Entwurf');
assert.equal(published?.street, 'PRIVATE STREET');
await assert.rejects(
  invoke(eventActions.setEventPublished, { id: 'deleted', published: true }, token),
  code('NOT_FOUND'),
);
await assert.rejects(
  invoke(eventActions.setEventPublished, { id: 'missing', published: true }, token),
  code('NOT_FOUND'),
);
