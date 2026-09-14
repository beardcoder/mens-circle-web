// Executed only by database-performance.test.ts in a disposable child process.
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { Database, type SQLQueryBindings } from 'bun:sqlite';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { NoopLogger, type Logger } from 'drizzle-orm/logger';

// Fail closed before importing the app's DB singleton. Never accept :memory:
// (config resolves it as a file) or a caller's real database path.
assert.ok(basename(process.cwd()).startsWith('mens-circle-db-test-'));
assert.equal(realpathSync(dirname(process.cwd())), realpathSync(tmpdir()));
assert.equal(process.env.DATABASE_PATH, join(process.cwd(), 'disposable.sqlite'));
assert.ok(process.env.MIGRATIONS_DIR);
assert.equal(process.env.LISTMONK_URL, undefined);
let networkCalls = 0;
Object.defineProperty(globalThis, 'fetch', {
  value: () => {
    networkCalls++;
    throw new Error('Network is forbidden in database tests');
  },
});

const { db } = await import('../src/lib/server/db');
const { events, participants, registrations, testimonials } = await import('../src/lib/server/db/schema');
const {
  countActiveRegistrations,
  eventDto,
  fetchNextEvent,
  fetchNextEventState,
  getEventBySlug,
  getNextEvent,
  getPublishedEventBySlug,
  listEventsForAdmin,
} = await import('../src/lib/server/events');
const { fetchTestimonials } = await import('../src/lib/server/testimonials');

type Query = { sql: string; params: SQLQueryBindings[] };
const queries: Query[] = [];
// Instrument Drizzle's actual execution logger in this child only. Capture the
// parameterized SQL and its bindings, not a reconstructed/inlined substitute.
(NoopLogger.prototype as Logger).logQuery = (sql: string, params: unknown[]) => {
  queries.push({ sql, params: params as SQLQueryBindings[] });
};

async function capture<T>(operation: () => Promise<T>, count: number) {
  queries.length = 0;
  const value = await operation();
  assert.equal(queries.length, count, JSON.stringify(queries));
  return { value, statements: [...queries] };
}

function explain(query: Query): string {
  const statement = db.$client.prepare<{ detail: string }, SQLQueryBindings[]>(`EXPLAIN QUERY PLAN ${query.sql}`);
  try {
    return statement
      .all(...query.params)
      .map((row) => row.detail)
      .join('\n');
  } finally {
    statement.finalize();
  }
}

const today = new Date();
const date = (offset: number) =>
  new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset)).toISOString();

function seedEvents() {
  db.insert(events)
    .values([
      { id: 'draft', slug: 'draft', title: 'Draft', eventDate: date(0), isPublished: false },
      { id: 'deleted', slug: 'deleted', title: 'Deleted', eventDate: date(0), isPublished: true, deleted: date(-1) },
      { id: 'past', slug: 'past', title: 'Past', eventDate: date(-1), isPublished: true },
      {
        id: 'today',
        slug: 'today',
        title: 'Today',
        eventDate: date(0),
        isPublished: true,
        maxParticipants: 4,
        description: 'Description',
        startTime: '19:00',
        endTime: '21:00',
        location: 'Room',
        locationDetails: 'Upstairs',
        street: 'Street',
        postalCode: '94315',
        city: 'Straubing',
        latitude: 48.88,
        longitude: 12.57,
        costBasis: 'Donation',
        imageUrl: '/image.webp',
      },
      { id: 'empty', slug: 'empty', title: 'Empty', eventDate: date(1), isPublished: true, maxParticipants: 3 },
      { id: 'full', slug: 'full', title: 'Full', eventDate: date(2), isPublished: true, maxParticipants: 2 },
      {
        id: 'overflow',
        slug: 'overflow',
        title: 'Overflow',
        eventDate: date(3),
        isPublished: true,
        maxParticipants: 1,
      },
    ])
    .run();
  for (const eventId of ['today', 'full', 'overflow', 'past']) {
    for (const [i, status] of (
      ['registered', 'attended', 'waitlist', 'cancelled', 'registered', 'attended'] as const
    ).entries()) {
      const id = `${eventId}-${i}`;
      db.insert(participants)
        .values({ id, email: `${id}@example.invalid` })
        .run();
      db.insert(registrations)
        .values({ id, participantId: id, eventId, status, deleted: i >= 4 ? date(-1) : null })
        .run();
    }
  }
}

async function checkEvents() {
  seedEvents();
  // The former lookup + DTO API remains a two-query reference path.
  const baseline = await capture(async () => eventDto((await getNextEvent())!), 2);
  assert.deepEqual(baseline.value, {
    id: 'today',
    title: 'Today',
    slug: 'today',
    description: 'Description',
    event_date: date(0),
    start_time: '19:00',
    end_time: '21:00',
    location: 'Room',
    location_details: 'Upstairs',
    street: 'Street',
    postal_code: '94315',
    city: 'Straubing',
    latitude: 48.88,
    longitude: 12.57,
    max_participants: 4,
    cost_basis: 'Donation',
    image_url: '/image.webp',
    available_spots: 2,
    is_full: false,
    is_past: false,
  });
  const next = await capture(fetchNextEvent, 1);
  assert.deepEqual(next.value, baseline.value);
  const state = await capture(fetchNextEventState, 1);
  assert.deepEqual(state.value, { status: 'scheduled', event: baseline.value });
  assert.match(next.statements[0].sql, /"registrations"\."event_id" = "events"\."id"/);
  assert.match(explain(next.statements[0]), /CORRELATED SCALAR SUBQUERY/);
  assert.match(explain(next.statements[0]), /idx_events_date/);
  assert.match(explain(next.statements[0]), /idx_registrations_event/);
  assert.ok(next.statements[0].params.includes('registered'));
  assert.ok(next.statements[0].params.includes('attended'));

  for (const [slug, available] of [
    ['today', 2],
    ['empty', 3],
    ['full', 0],
    ['overflow', 0],
    ['past', 6],
  ] as const) {
    const legacy = await capture(async () => eventDto((await getPublishedEventBySlug(slug))!), 2);
    const current = await capture(() => getEventBySlug(slug), 1);
    assert.deepEqual(current.value, legacy.value);
    assert.equal(current.value?.available_spots, available);
    assert.equal(current.value?.is_full, available === 0);
    assert.equal(current.value?.is_past, slug === 'past');
    const plan = explain(current.statements[0]);
    assert.match(plan, /idx_events_slug/);
    assert.match(plan, /idx_registrations_event/);
  }
  for (const slug of ['draft', 'deleted', 'missing', "' OR 1=1 --"]) {
    assert.equal((await capture(() => getEventBySlug(slug), 1)).value, null);
  }
  const raw = await capture(() => getPublishedEventBySlug('today'), 1);
  assert.doesNotMatch(raw.statements[0].sql, /count\(|registrations/i);
  assert.equal(raw.value?.isPublished, true);
  const admin = await listEventsForAdmin();
  assert.equal(admin.find((row) => row.id === 'today')?.activeCount, await countActiveRegistrations('today'));

  // Exact DB helper compositions used by home and /event (no HTTP/network).
  for (const limit of [undefined, 1]) {
    await capture(async () => Promise.all([fetchNextEventState(), fetchTestimonials(limit)]), 2);
    await capture(
      async () => Promise.all([getNextEvent().then((event) => eventDto(event!)), fetchTestimonials(limit)]),
      3,
    );
  }
  // No cross-request cache: a new seat must affect the very next read.
  db.update(registrations).set({ status: 'registered' }).where(eq(registrations.id, 'today-2')).run();
  assert.equal((await capture(fetchNextEvent, 1)).value?.available_spots, 1);
}

async function checkStates() {
  assert.deepEqual((await capture(fetchNextEventState, 1)).value, { status: 'none', event: null });
  assert.equal((await capture(fetchNextEvent, 1)).value, null);
  seedEvents();
  db.update(events).set({ isPublished: false }).where(eq(events.id, 'today')).run();
  assert.equal((await fetchNextEvent())?.id, 'empty');
  db.update(events)
    .set({ isPublished: false })
    .where(and(eq(events.isPublished, true), isNull(events.deleted)))
    .run();
  db.update(events).set({ isPublished: true }).where(eq(events.id, 'past')).run();
  assert.deepEqual(await fetchNextEventState(), { status: 'none', event: null });
  db.update(events).set({ isPublished: true }).where(eq(events.id, 'today')).run();
  // A capacity-query failure is unavailable, not an empty scheduling state.
  db.$client.run('DROP TABLE registrations');
  assert.deepEqual(await fetchNextEventState(), { status: 'unavailable', event: null });
  assert.equal(await fetchNextEvent(), null);
  assert.equal(await getEventBySlug('today'), null);
  // ICS still has no dependency on registrations/capacity.
  assert.equal((await getPublishedEventBySlug('today'))?.id, 'today');
  db.$client.run('DROP TABLE events');
  assert.deepEqual(await fetchNextEventState(), { status: 'unavailable', event: null });
  assert.equal(await fetchNextEvent(), null);
  assert.equal(await getEventBySlug('today'), null);
}

async function checkTestimonials() {
  assert.deepEqual(await fetchTestimonials(), []);
  db.insert(testimonials)
    .values(
      Array.from({ length: 250 }, (_, i) => ({
        id: `voice-${i}`,
        quote: `Quote ${i}`,
        authorName: i % 2 ? `Author ${i}` : '',
        role: i % 3 ? 'Participant' : '',
        email: `private-${i}@example.invalid`,
        isPublished: true,
        sortOrder: i % 5,
        createdAt: date(-i),
      })),
    )
    .run();
  db.insert(testimonials)
    .values([
      { quote: 'Unpublished', isPublished: false, sortOrder: -1 },
      { quote: 'Soft-deleted', isPublished: true, sortOrder: -1, deleted: date(0) },
    ])
    .run();

  for (const limit of [0, 1, 7, 200, 300]) {
    const baseline = await db
      .select()
      .from(testimonials)
      .where(and(eq(testimonials.isPublished, true), isNull(testimonials.deleted)))
      .orderBy(asc(testimonials.sortOrder), desc(testimonials.createdAt))
      .limit(limit);
    const current = await capture(() => fetchTestimonials(limit), 1);
    assert.deepEqual(
      current.value,
      baseline.map((row) => ({
        quote: row.quote,
        author: row.authorName || null,
        role: row.role || null,
      })),
    );
    const query = current.statements[0];
    assert.match(query.sql, /^select "quote", "author_name", "role" from/);
    assert.doesNotMatch(query.sql, /"email"|"published_at"|"updated_at"/);
    assert.deepEqual(query.params, [1, limit]);
    if (limit > 0) {
      const plan = explain(query);
      assert.match(plan, /SEARCH testimonials USING INDEX idx_testimonials_public_order/);
      assert.doesNotMatch(plan, /TEMP B-TREE|SCAN testimonials/);
    }
  }
  assert.equal((await fetchTestimonials()).length, 200);
  db.$client.run('DROP TABLE testimonials');
  assert.deepEqual(await fetchTestimonials(), []);
}

function checkMigration() {
  const migrations = process.env.MIGRATIONS_DIR!;
  const journal = JSON.parse(readFileSync(join(migrations, 'meta/_journal.json'), 'utf8'));
  const baseline = join(process.cwd(), 'baseline');
  mkdirSync(join(baseline, 'meta'), { recursive: true });
  writeFileSync(
    join(baseline, 'meta/_journal.json'),
    JSON.stringify({ ...journal, entries: journal.entries.slice(0, 1) }),
  );
  const original = `${journal.entries[0].tag}.sql`;
  copyFileSync(join(migrations, original), join(baseline, original));
  const sqlite = new Database(join(process.cwd(), 'upgrade.sqlite'));
  try {
    const upgrade = drizzle(sqlite);
    migrate(upgrade, { migrationsFolder: baseline });
    sqlite.run(
      "INSERT INTO testimonials (id, quote, created_at, updated_at) VALUES ('kept', 'Keep me', '2026-01-01', '2026-01-01')",
    );
    migrate(upgrade, { migrationsFolder: migrations });
    migrate(upgrade, { migrationsFolder: migrations }); // Repeated boot is idempotent.
    assert.equal(sqlite.query<{ quote: string }, []>('SELECT quote FROM testimonials').get()?.quote, 'Keep me');
    const index = sqlite
      .query<{ sql: string }, []>("SELECT sql FROM sqlite_master WHERE name = 'idx_testimonials_public_order'")
      .get();
    assert.ok(index);
    assert.match(index.sql, /is_published.*sort_order.*created_at.*desc/i);
    assert.match(index.sql, /where.*deleted.*is null/i);
    assert.equal(sqlite.query<{ integrity_check: string }, []>('PRAGMA integrity_check').get()?.integrity_check, 'ok');
  } finally {
    sqlite.close();
  }
}

try {
  switch (process.argv[2]) {
    case 'events':
      await checkEvents();
      break;
    case 'states':
      await checkStates();
      break;
    case 'testimonials':
      await checkTestimonials();
      break;
    case 'migration':
      checkMigration();
      break;
    default:
      throw new Error('Unknown database test scenario');
  }
  assert.equal(networkCalls, 0);
} finally {
  db.$client.close();
}
