/* eslint-disable no-console */
// Executed only by email-backend.test.ts in a separate Bun process; not a suite-level module mock.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { config } from '../src/lib/server/config';
import { events, participants, registrations } from '../src/lib/server/db/schema';

assert(process.env.EMAIL_TEST_DIR, 'requires the isolated test harness');
assert.equal(config.DATABASE_PATH, join(process.env.EMAIL_TEST_DIR, 'test.sqlite'));
assert.equal(config.LISTMONK_URL, 'https://newsletter.example.invalid');

type Call = { method: string; path: string; body: Record<string, unknown> };
const calls: Call[] = [];
let active = 0;
let peak = 0;
const pause = () => new Promise((resolve) => setTimeout(resolve, 2));
const json = (data: unknown, status = 200) => Response.json(data, { status });
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
let handler: (call: Call) => Response | Promise<Response> = () => {
  throw new Error('unexpected HTTP');
};

// Never retain a reference to real fetch, even on an assertion failure.
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  assert.equal(url.origin, 'https://newsletter.example.invalid');
  assert(url.pathname.startsWith('/api/'), 'base URL must not introduce duplicate slashes');
  assert.equal(new Headers(init?.headers).get('Authorization'), 'token test:test');
  assert(init?.signal instanceof AbortSignal);
  const call = {
    method: init?.method ?? 'GET',
    path: url.pathname + url.search,
    body: JSON.parse(String(init?.body ?? '{}')),
  };
  calls.push(call);
  peak = Math.max(peak, ++active);
  try {
    await pause();
    return await handler(call);
  } finally {
    active--;
  }
}) as typeof fetch;

const lm = await import('../src/lib/server/listmonk');
const subscriber = { id: 42, email: 'person@example.invalid', name: 'Person', status: 'enabled', lists: [{ id: 9 }] };
const seed = async (count = 10) => {
  const { db } = await import('../src/lib/server/db');
  const today = new Date().toISOString().slice(0, 10);
  const [event] = await db
    .insert(events)
    .values({
      title: 'Test',
      slug: 'test',
      eventDate: `${today}T12:00:00.000Z`,
      isPublished: true,
      maxParticipants: 50,
      listmonkListId: 7,
    })
    .returning();
  for (let i = 0; i < count; i++) {
    const [participant] = await db
      .insert(participants)
      .values({ email: `p${i}@example.invalid`, firstName: `P${i}` })
      .returning();
    await db.insert(registrations).values({
      id: `r${i}`,
      eventId: event.id,
      participantId: participant.id,
      status: 'registered',
      registeredAt: String(i).padStart(3, '0'),
    });
  }
  return { db, event };
};
const txHandler = (call: Call) => {
  if (call.path === '/api/subscribers')
    return json({ data: { id: Number(String(call.body.email).match(/^p(\d+)/)?.[1] ?? 99) + 1 } });
  if (call.path === '/api/tx') {
    if (call.body.subscriber_id === 2) return json({}, 503);
    if (call.body.subscriber_id === 3) throw new Error('simulated transport failure');
    return json({});
  }
  throw new Error(`unexpected request: ${call.path}`);
};

const scenarios: Record<string, () => Promise<void>> = {
  async 'external-url'() {
    handler = (call) => (call.path === '/api/subscribers' ? json({ data: subscriber }) : json({}));
    assert.deepEqual(await lm.subscribeToNewsletter(subscriber.email, 'Person'), { ok: true, status: 'subscribed' });
    assert.equal(await lm.sendTransactional(1, subscriber.email, 'Person', { subject: 'External service' }), true);
    assert.deepEqual(
      calls.map((call) => [call.method, call.path]),
      [
        ['POST', '/api/subscribers'],
        ['POST', '/api/subscribers'],
        ['POST', '/api/tx'],
      ],
    );
    assert.deepEqual(calls[2].body.data, { subject: 'External service' });
  },
  async 'provisioning-dedupe'() {
    handler = () => json({ data: subscriber });
    assert.deepEqual(
      await Promise.all([
        lm.ensureSubscriber(' PERSON@EXAMPLE.INVALID ', 'Person'),
        lm.ensureSubscriber('person@example.invalid', 'Person'),
        lm.ensureSubscriber('Person@Example.Invalid', 'Person'),
      ]),
      [42, 42, 42],
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.email, 'person@example.invalid');
    await lm.ensureSubscriber('person@example.invalid', 'Person');
    assert.equal(calls.length, 2, 'successful completion must evict global identity');
    await Promise.all([lm.ensureSubscriber('a@example.invalid', 'A'), lm.ensureSubscriber('b@example.invalid', 'B')]);
    assert.equal(calls.length, 4, 'different email addresses must not share identity');
  },
  async 'provisioning-conflict'() {
    handler = (call) => (call.method === 'POST' ? json({}, 409) : json({ data: { results: [subscriber] } }));
    assert.deepEqual(
      await Promise.all(Array.from({ length: 8 }, () => lm.ensureSubscriber(subscriber.email, 'Person'))),
      Array(8).fill(42),
    );
    assert.equal(calls.length, 2, 'one POST + one GET for all concurrent callers');
    await lm.ensureSubscriber(subscriber.email, 'Person');
    assert.equal(calls.length, 4);
  },
  async 'provisioning-errors'() {
    const timeoutMs: number[] = [];
    AbortSignal.timeout = (ms) => {
      timeoutMs.push(ms);
      return new AbortController().signal;
    };
    for (const status of [401, 422, 429, 500]) {
      handler = () => json({}, status);
      const before = calls.length;
      assert.deepEqual(
        await Promise.all([
          lm.ensureSubscriber(subscriber.email, 'Person'),
          lm.ensureSubscriber(subscriber.email, 'Person'),
        ]),
        [0, 0],
      );
      assert.equal(calls.length, before + 1, 'non-conflicts must never trigger lookup');
    }
    handler = () => {
      throw new DOMException('timeout', 'TimeoutError');
    };
    assert.equal(await lm.ensureSubscriber(subscriber.email, 'Person'), 0);
    handler = () => json({ data: {} });
    assert.equal(await lm.ensureSubscriber(subscriber.email, 'Person'), 0);
    handler = (call) => (call.method === 'POST' ? json({}, 409) : json({ data: { results: [] } }));
    assert.equal(await lm.ensureSubscriber(subscriber.email, 'Person'), 0);
    handler = () => json({ data: subscriber });
    assert.equal(await lm.ensureSubscriber(subscriber.email, 'Person'), 42, 'failure completion must permit retry');
    assert(timeoutMs.every((ms) => ms === 15_000));
  },
  async 'workflow-reuse'() {
    for (const existing of [false, true]) {
      calls.length = 0;
      handler = (call) => {
        if (call.path === '/api/subscribers') return existing ? json({}, 409) : json({ data: subscriber });
        if (call.method === 'GET') return json({ data: { results: [subscriber] } });
        return json({});
      };
      await lm.withSubscriberScope(async () => {
        assert.equal(await lm.sendTransactional(1, subscriber.email, 'Person', {}), true);
        // Deliberately after provisioning has settled: in-flight deduplication alone cannot save this work.
        assert.deepEqual(await lm.addToLists(subscriber.email, 'Person', [7], true), {
          ok: true,
          status: existing ? 'exists' : 'subscribed',
        });
      });
      assert.equal(calls.length, existing ? 4 : 3, 'provision once, then TX + membership PUT');
      await lm.ensureSubscriber(subscriber.email, 'Person');
      assert.equal(calls.length, existing ? 6 : 4, 'workflow identity must not escape its lifetime');
    }
    await assert.rejects(
      lm.withSubscriberScope(async () => {
        await lm.ensureSubscriber(subscriber.email, 'Person');
        throw new Error('workflow failed');
      }),
    );
    const before = calls.length;
    await lm.ensureSubscriber(subscriber.email, 'Person');
    assert.equal(calls.length, before + 2, 'failed workflow must also release identity');
  },
  async 'membership-failure'() {
    for (const scoped of [false, true]) {
      for (const transport of [false, true]) {
        calls.length = 0;
        handler = (call) => {
          if (call.method === 'POST') return json({}, 409);
          if (call.method === 'GET') return json({ data: { results: [{ ...subscriber, name: '' }] } });
          if (transport) throw new Error('membership transport error');
          return json({}, 500);
        };
        const work = () => lm.addToLists(subscriber.email, 'Person', [7], true);
        assert.deepEqual(await (scoped ? lm.withSubscriberScope(work) : work()), { ok: false, status: 'error' });
        assert.equal(calls.length, 3, 'failed membership must not continue to name update');
      }
    }
  },
  async 'consent-and-status'() {
    handler = () => json({ data: subscriber });
    assert.deepEqual(await lm.subscribeToNewsletter(subscriber.email, 'Person'), { ok: true, status: 'subscribed' });
    assert.deepEqual(calls[0].body.lists, [9]);
    assert.equal(calls[0].body.preconfirm_subscriptions, false);
    handler = () => json({}, 409);
    assert.deepEqual(await lm.subscribeToNewsletter(subscriber.email, 'Person'), { ok: true, status: 'exists' });
    assert.equal(calls.length, 2, 'newsletter conflict must not add/confirm membership');
    handler = () => json({ data: subscriber });
    assert.deepEqual(await lm.addToLists(subscriber.email, 'Person', [7], false), { ok: true, status: 'subscribed' });
    assert.equal(calls[2].body.preconfirm_subscriptions, false);
    for (const scoped of [false, true]) {
      calls.length = 0;
      handler = (call) => {
        if (call.method === 'POST') return json({}, 409);
        if (call.method === 'GET')
          return json({ data: { results: [{ ...subscriber, name: '', status: 'blocklisted' }] } });
        return json({});
      };
      const work = () => lm.addToLists(subscriber.email, 'Person', [7], false);
      assert.deepEqual(await (scoped ? lm.withSubscriberScope(work) : work()), { ok: true, status: 'exists' });
      assert.deepEqual(calls[2].body, { ids: [42], action: 'add', target_list_ids: [7], status: 'unconfirmed' });
      assert.deepEqual(calls[3].body, {
        email: subscriber.email,
        name: 'Person',
        status: 'blocklisted',
        lists: [9, 7],
        preconfirm_subscriptions: false,
      });
    }
  },
  async 'reminder-acceptance'() {
    const { db } = await seed(13);
    await db.update(registrations).set({ status: 'waitlist' }).where(eq(registrations.id, 'r10'));
    await db.update(registrations).set({ status: 'cancelled' }).where(eq(registrations.id, 'r11'));
    await db.update(registrations).set({ deleted: 'deleted' }).where(eq(registrations.id, 'r12'));
    await db.update(registrations).set({ status: 'attended' }).where(eq(registrations.id, 'r9'));
    handler = txHandler;
    const { runReminders } = await import('../src/lib/server/reminders');
    await runReminders();
    const rows = await db.select().from(registrations);
    assert.equal(rows.filter((row) => row.reminderSentAt).length, 8);
    for (const id of ['r1', 'r2', 'r10', 'r11', 'r12'])
      assert.equal(rows.find((row) => row.id === id)?.reminderSentAt, null);
    assert.equal(calls.filter((call) => call.path === '/api/tx').length, 10);
    assert.equal(peak, 4);
    calls.length = 0;
    await runReminders();
    assert.equal(calls.filter((call) => call.path === '/api/tx').length, 2, 'only failed reminders remain pending');
  },
  async 'reminder-disabled'() {
    const { db } = await seed(2);
    const { runReminders } = await import('../src/lib/server/reminders');
    const { sendEventReminder } = await import('../src/lib/server/email');
    const [event] = await db.select().from(events);
    const [participant] = await db.select().from(participants);
    config.TX_EVENT_REMINDER = 0;
    assert.equal(await sendEventReminder(event, participant, false), false);
    await runReminders();
    config.TX_EVENT_REMINDER = 4;
    config.LISTMONK_API_TOKEN = '';
    await runReminders();
    assert.equal(calls.length, 0);
    assert((await db.select().from(registrations)).every((row) => row.reminderSentAt === null));
  },
  async 'reminder-stamp-failure'() {
    const { db } = await seed(10);
    db.run(
      sql`CREATE TRIGGER fail_one_stamp BEFORE UPDATE OF reminder_sent_at ON registrations WHEN NEW.id = 'r0' BEGIN SELECT RAISE(FAIL, 'simulated stamp failure'); END`,
    );
    handler = (call) => (call.path === '/api/subscribers' ? json({ data: subscriber }) : json({}));
    const { runReminders } = await import('../src/lib/server/reminders');
    await runReminders();
    assert.equal((await db.select().from(registrations)).filter((row) => row.reminderSentAt).length, 9);
    assert.equal(
      calls.filter((call) => call.path === '/api/tx').length,
      10,
      'a thrown dispatch must not stop later recipients',
    );
    assert.equal(peak, 4);
  },
  async broadcast() {
    const { db, event } = await seed(14);
    for (const [id, status] of [
      ['r10', 'waitlist'],
      ['r11', 'cancelled'],
      ['r12', 'attended'],
    ] as const) {
      await db.update(registrations).set({ status }).where(eq(registrations.id, id));
    }
    await db.update(registrations).set({ deleted: 'deleted' }).where(eq(registrations.id, 'r13'));
    handler = txHandler;
    const { broadcastEventMessage } = await import('../src/lib/server/registrations');
    assert.deepEqual(await broadcastEventMessage(event.id, 'Subject', 'Hello {first_name}'), { sent: 8, total: 10 });
    assert.equal(peak, 4);
    assert.equal(calls.filter((call) => call.path === '/api/tx').length, 10);
    assert.deepEqual(await broadcastEventMessage('missing', 'Subject', 'Content'), { sent: 0, total: 0 });
  },
  async 'registration-async'() {
    const { db, event } = await seed(0);
    const gate = deferred();
    const done = deferred();
    let completed = 0;
    handler = async (call) => {
      await gate.promise;
      if (call.path === '/api/subscribers')
        return json({
          data: { ...subscriber, email: call.body.email, id: call.body.email === 'admin@example.invalid' ? 43 : 42 },
        });
      if (++completed === 3) done.resolve();
      return json({});
    };
    const { register } = await import('../src/lib/server/registrations');
    const result = await register({
      event_id: event.id,
      email: ' PERSON@EXAMPLE.INVALID ',
      first_name: 'Person',
      last_name: '',
      phone_number: '',
    });
    assert.equal(result.status, 200, 'registration must resolve while all HTTP is still blocked');
    assert.equal(completed, 0);
    assert.equal((await db.select().from(registrations)).length, 1);
    gate.resolve();
    await done.promise;
    assert.equal(calls.length, 5, 'participant provision + admin provision + 2 TX + membership');
    assert.equal(
      calls.filter((call) => call.path === '/api/subscribers' && call.body.email === subscriber.email).length,
      1,
    );
    assert.equal(
      calls.some((call) => Array.isArray(call.body.lists) && call.body.lists.includes(9)),
      false,
      'registration must not subscribe to newsletter',
    );
    assert.deepEqual(calls.find((call) => call.path === '/api/subscribers/lists')?.body, {
      ids: [42],
      action: 'add',
      target_list_ids: [7],
      status: 'confirmed',
    });
    await pause();
    await lm.ensureSubscriber(subscriber.email, 'Person');
    assert.equal(calls.length, 6, 'registration identity must not become a global ID cache');
  },
  async 'waitlist-promotion'() {
    const { db, event } = await seed(5);
    // r0-r3 hold seats; r4 waits. (p4's derived subscriber id is 5 — clear of
    // the ids txHandler special-cases to fail, which would otherwise muddy
    // what this scenario is actually testing.)
    await db.update(registrations).set({ status: 'waitlist' }).where(eq(registrations.id, 'r4'));

    const { changeRegistrationStatus } = await import('../src/lib/server/registrations');

    // Cancelling a SEAT (r0, 'registered') frees one — the sole waitlisted
    // entry must be promoted and mailed. The mail is fire-and-forget from
    // changeRegistrationStatus's own return, so gate on the actual /api/tx
    // call rather than racing a fixed delay.
    const promoted = deferred();
    handler = (call) => {
      if (call.path === '/api/tx') promoted.resolve();
      return txHandler(call);
    };
    await changeRegistrationStatus('r0', 'cancelled');
    await promoted.promise;
    let rows = await db.select().from(registrations);
    assert.equal(rows.find((row) => row.id === 'r4')?.status, 'registered', 'the waitlisted entry is promoted');
    assert.equal(
      calls.filter((call) => call.path === '/api/tx' && call.body.template_id === config.TX_WAITLIST_PROMOTION).length,
      1,
      'the promoted participant is mailed exactly once',
    );

    // Cancelling a fresh WAITLIST entry that never held a seat must never
    // promote anyone — even though a second person is genuinely still
    // waiting and available to be (wrongly) promoted. This is the exact bug
    // this scenario guards against: promotion used to run for ANY cancelled
    // entry regardless of what its own status had been, so this second
    // waiter would have been promoted purely because someone else on the
    // waitlist cancelled.
    calls.length = 0;
    handler = txHandler;
    const waiters = await db
      .insert(participants)
      .values([
        { email: 'late@example.invalid', firstName: 'Late' },
        { email: 'still-waiting@example.invalid', firstName: 'Waiting' },
      ])
      .returning();
    await db.insert(registrations).values([
      { id: 'r-late', eventId: event.id, participantId: waiters[0].id, status: 'waitlist', registeredAt: '998' },
      {
        id: 'r-still-waiting',
        eventId: event.id,
        participantId: waiters[1].id,
        status: 'waitlist',
        registeredAt: '999',
      },
    ]);
    await changeRegistrationStatus('r-late', 'cancelled');
    // Nothing async to await: with the fix, this path never calls
    // promoteNextWaitlisted, so no fetch is even scheduled. A short pause is
    // defensive margin only, in case a future change makes that path async
    // without immediately reaching the network.
    await pause();
    rows = await db.select().from(registrations);
    assert.equal(rows.find((row) => row.id === 'r-late')?.status, 'cancelled');
    assert.equal(
      rows.find((row) => row.id === 'r-still-waiting')?.status,
      'waitlist',
      'the other waiter is untouched, not promoted',
    );
    assert.equal(
      calls.filter((call) => call.path === '/api/tx' && call.body.template_id === config.TX_WAITLIST_PROMOTION).length,
      0,
      'cancelling a waitlist entry must never promote anyone — it held no seat',
    );
  },
};

const scenario = process.argv[2];
assert(scenario in scenarios, `unknown scenario: ${scenario}`);
await scenarios[scenario]();
assert.equal(active, 0);
console.log(`PASS ${scenario}`);
