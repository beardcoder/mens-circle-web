/* eslint-disable no-console */
import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';

import { settleWithConcurrency } from './concurrency';
import { db } from './db';
import type { Event, Participant, Registration, RegistrationStatus } from './db/schema';
import { ACTIVE_REGISTRATION_STATUSES, events, participants, registrations } from './db/schema';
import { sendEventMessage, sendRegistrationConfirmation, sendRegistrationEmails, sendWaitlistPromotion } from './email';
import { countActiveRegistrations, ensureEventList, getEventById, holdsASeat, isEventPast } from './events';
import { accepted, type FormResult, rejected } from './form-submission';
import { addToLists, removeFromList, withSubscriberScope } from './listmonk';

/** The two statuses a fresh registration can be given; the rest are admin transitions. */
type IntakeStatus = Extract<RegistrationStatus, 'registered' | 'waitlist'>;

const fireAndForget = (label: string, promise: Promise<unknown>): void => {
  void promise.catch((err) => console.error(label, String(err)));
};

type ParticipantFields = { firstName?: string; lastName?: string; phone?: string };

/** What a sign-up typed that differs from the stored participant (kept on the registration). */
export interface SubmittedDetails {
  submittedFirstName: string | null;
  submittedLastName: string | null;
  submittedPhone: string | null;
}

const differs = (typed: string | undefined, stored: string): string | null =>
  typed && typed !== stored ? typed : null;

/**
 * Finds or creates the participant for a public sign-up. The address is not
 * verified, so an existing participant only gets empty fields filled: nobody can
 * overwrite someone else's name or phone by typing their address. What differs is
 * returned and stored on the registration for the admin.
 */
const upsertParticipant = async (
  email: string,
  fields: ParticipantFields,
): Promise<{ participant: Participant; submitted: SubmittedDetails }> => {
  const existing = (await db.select().from(participants).where(eq(participants.email, email)).limit(1))[0];

  if (!existing) {
    const [participant] = await db
      .insert(participants)
      .values({ email, firstName: fields.firstName ?? '', lastName: fields.lastName ?? '', phone: fields.phone ?? '' })
      .returning();

    return { participant, submitted: { submittedFirstName: null, submittedLastName: null, submittedPhone: null } };
  }

  const patch: Partial<Participant> = {};

  if (!existing.firstName && fields.firstName) patch.firstName = fields.firstName;

  if (!existing.lastName && fields.lastName) patch.lastName = fields.lastName;

  if (!existing.phone && fields.phone) patch.phone = fields.phone;

  const participant =
    Object.keys(patch).length > 0
      ? (await db.update(participants).set(patch).where(eq(participants.id, existing.id)).returning())[0]
      : existing;

  return {
    participant,
    submitted: {
      submittedFirstName: differs(fields.firstName, participant.firstName),
      submittedLastName: differs(fields.lastName, participant.lastName),
      submittedPhone: differs(fields.phone, participant.phone),
    },
  };
};

/** The registration form, already validated by the `register` action's schema. */
export interface RegistrationInput {
  event_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string | null;
}

interface RegistrationFields {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  eventId: string;
}

const readFields = (payload: RegistrationInput): RegistrationFields => ({
  firstName: (payload.first_name || '').trim(),
  lastName: (payload.last_name || '').trim(),
  email: (payload.email || '').trim().toLowerCase(),
  phone: (payload.phone_number || '').trim(),
  eventId: payload.event_id,
});

export const confirmationMessage = (firstName: string): string =>
  `Vielen Dank, ${firstName}! Deine Anmeldung war erfolgreich. Du erhältst in Kürze eine Bestätigung per E-Mail.`;

/** The event this registration may still join, or the answer explaining why it may not. */
const openEvent = async (eventId: string): Promise<{ event: Event } | { error: FormResult }> => {
  const event = await getEventById(eventId);

  if (!event || !event.isPublished || event.deleted) {
    return { error: rejected(404, 'Diese Veranstaltung ist nicht verfügbar.') };
  }

  if (isEventPast(event)) {
    return {
      error: rejected(410, 'Diese Veranstaltung hat bereits stattgefunden. Eine Anmeldung ist nicht mehr möglich.'),
    };
  }

  return { event };
};

/**
 * Claims a seat (registered or waitlist) from a recount in the same transaction.
 * The callback must stay synchronous: bun:sqlite transactions wrap a plain function,
 * so an `await` would commit before the awaited work runs.
 */
const claimSeat = (
  participantId: string,
  event: Event,
  submitted: SubmittedDetails,
): { registrationId: string; status: IntakeStatus } | { error: FormResult } =>
  db.transaction(
    (tx) => {
      const existing = tx
        .select()
        .from(registrations)
        .where(and(eq(registrations.participantId, participantId), eq(registrations.eventId, event.id)))
        .get();

      if (existing && !existing.deleted) {
        return {
          error: rejected(
            409,
            existing.status === 'waitlist'
              ? 'Du bist bereits auf der Warteliste für diese Veranstaltung.'
              : 'Du bist bereits für diese Veranstaltung angemeldet.',
          ),
        };
      }

      const activeCount =
        tx
          .select({ c: sql<number>`count(*)` })
          .from(registrations)
          .where(and(eq(registrations.eventId, event.id), holdsASeat()))
          .get()?.c ?? 0;

      const status: IntakeStatus = activeCount >= event.maxParticipants ? 'waitlist' : 'registered';
      const registeredAt = new Date().toISOString();

      if (existing) {
        // A revived seat starts over: the old confirmation no longer describes it.
        tx.update(registrations)
          .set({ status, registeredAt, cancelledAt: null, deleted: null, confirmationSentAt: null, ...submitted })
          .where(eq(registrations.id, existing.id))
          .run();

        return { registrationId: existing.id, status };
      }

      const inserted = tx
        .insert(registrations)
        .values({ participantId, eventId: event.id, status, registeredAt, ...submitted })
        .returning()
        .get();

      return { registrationId: inserted.id, status };
    },
    { behavior: 'immediate' },
  );

/** Record that the participant's copy of the confirmation actually left listmonk. */
const markConfirmationSent = async (registrationId: string): Promise<void> => {
  await db
    .update(registrations)
    .set({ confirmationSentAt: new Date().toISOString() })
    .where(eq(registrations.id, registrationId));
};

const assignToEventList = async (event: Event, fields: RegistrationFields): Promise<void> => {
  const listId = await ensureEventList(event);

  if (!listId) return;

  const result = await addToLists(fields.email, `${fields.firstName} ${fields.lastName}`.trim(), [listId], true);

  if (!result.ok) throw new Error('listmonk assignment rejected');
};

/** Mail and list membership after booking; not awaited, so listmonk can't fail a booked seat. */
const dispatchSideEffects = (
  event: Event,
  participant: Participant,
  fields: RegistrationFields,
  status: IntakeStatus,
  activeCount: number,
  registrationId: string,
): void => {
  fireAndForget(
    '[registrations] side effects failed',
    withSubscriberScope(async () => {
      const mails = sendRegistrationEmails(event, participant, status, activeCount, registrationId).then(
        async (userSent) => {
          if (userSent) await markConfirmationSent(registrationId);

          return userSent;
        },
      );

      const tasks: Array<[string, Promise<unknown>]> = [
        ['emails', mails],
        ['listmonk assignment', assignToEventList(event, fields)],
      ];

      const results = await Promise.allSettled(tasks.map(([, task]) => task));

      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          console.error(`[registrations] ${tasks[i][0]} failed`, String(result.reason));
        }
      });
    }),
  );
};

export const register = async (payload: RegistrationInput): Promise<FormResult> => {
  const fields = readFields(payload);
  const found = await openEvent(fields.eventId);

  if ('error' in found) return found.error;

  const { event } = found;

  const { participant, submitted } = await upsertParticipant(fields.email, fields);
  const seat = claimSeat(participant.id, event, submitted);

  if ('error' in seat) return seat.error;

  const { status, registrationId } = seat;

  dispatchSideEffects(event, participant, fields, status, await countActiveRegistrations(event.id), registrationId);

  return accepted(
    status === 'waitlist'
      ? `Du wurdest auf die Warteliste eingetragen, ${fields.firstName}. Wir benachrichtigen dich per E-Mail, sobald ein Platz frei wird.`
      : confirmationMessage(fields.firstName),
  );
};

export interface RegistrationRow {
  id: string;
  status: RegistrationStatus;
  registeredAt: string | null;
  cancelledAt: string | null;
  confirmationSentAt: string | null;
  reminderSentAt: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Typed at sign-up but not stored on the participant (see `upsertParticipant`). */
  submittedFirstName: string | null;
  submittedLastName: string | null;
  submittedPhone: string | null;
}

export const listRegistrationsForEvent = (eventId: string): Promise<RegistrationRow[]> =>
  db
    .select({
      id: registrations.id,
      status: registrations.status,
      registeredAt: registrations.registeredAt,
      cancelledAt: registrations.cancelledAt,
      confirmationSentAt: registrations.confirmationSentAt,
      reminderSentAt: registrations.reminderSentAt,
      firstName: participants.firstName,
      lastName: participants.lastName,
      email: participants.email,
      phone: participants.phone,
      submittedFirstName: registrations.submittedFirstName,
      submittedLastName: registrations.submittedLastName,
      submittedPhone: registrations.submittedPhone,
    })
    .from(registrations)
    .innerJoin(participants, eq(registrations.participantId, participants.id))
    .where(and(eq(registrations.eventId, eventId), isNull(registrations.deleted)))
    .orderBy(asc(registrations.registeredAt));

const participantById = async (id: string): Promise<Participant | undefined> =>
  (await db.select().from(participants).where(eq(participants.id, id)).limit(1))[0];

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const seatsTaken = (tx: Tx, eventId: string): number =>
  tx
    .select({ c: sql<number>`count(*)` })
    .from(registrations)
    .where(and(eq(registrations.eventId, eventId), holdsASeat()))
    .get()?.c ?? 0;

const holdsSeatStatus = (status: RegistrationStatus): boolean =>
  (ACTIVE_REGISTRATION_STATUSES as readonly RegistrationStatus[]).includes(status);

/**
 * Fills free seats from the waitlist, oldest first, in one write transaction with a
 * recount (synchronous, like `claimSeat`), so parallel calls never promote twice.
 * Past and deleted events promote nobody. `skip` keeps one registration out of the
 * queue (someone the admin just moved to the waitlist).
 */
const promoteWaiting = (
  eventId: string,
  skip?: string,
): { event: Event; promoted: Array<{ id: string; participantId: string }> } | null =>
  db.transaction(
    (tx) => {
      const event = tx.select().from(events).where(eq(events.id, eventId)).get();

      if (!event || event.deleted || isEventPast(event)) return null;

      const free = event.maxParticipants - seatsTaken(tx, eventId);

      if (free <= 0) return null;

      const waiting = tx
        .select({ id: registrations.id, participantId: registrations.participantId })
        .from(registrations)
        .where(
          and(
            eq(registrations.eventId, eventId),
            eq(registrations.status, 'waitlist'),
            isNull(registrations.deleted),
            skip ? ne(registrations.id, skip) : undefined,
          ),
        )
        .orderBy(asc(registrations.registeredAt))
        .limit(free)
        .all();

      if (!waiting.length) return null;

      tx.update(registrations)
        .set({ status: 'registered', registeredAt: new Date().toISOString() })
        .where(
          inArray(
            registrations.id,
            waiting.map((row) => row.id),
          ),
        )
        .run();

      return { event, promoted: waiting };
    },
    { behavior: 'immediate' },
  );

/**
 * Settles an event's seats after any change to its registrations or capacity:
 * promotes as many waiters as seats are free and mails them outside the transaction.
 * Resolves to the number of promoted registrations.
 */
export const reconcileSeats = async (eventId: string, opts: { skip?: string } = {}): Promise<number> => {
  const result = promoteWaiting(eventId, opts.skip);

  if (!result) return 0;

  const people = await db
    .select()
    .from(participants)
    .where(
      inArray(
        participants.id,
        result.promoted.map((row) => row.participantId),
      ),
    );

  for (const { id, participantId } of result.promoted) {
    const participant = people.find((p) => p.id === participantId);

    if (participant) {
      fireAndForget('[registrations] promotion email failed', sendWaitlistPromotion(result.event, participant, id));
    }
  }

  return result.promoted.length;
};

export type StatusChange =
  | { ok: true; registration: Registration; previousStatus: RegistrationStatus }
  | { ok: false; reason: 'not-found' | 'full' };

/**
 * Sets a registration's status. A change that takes a seat is refused when the event
 * is full, unless `overbook` says the admin means it. Moving someone to the waitlist
 * puts them at its end. Afterwards the seats are reconciled.
 */
const isFull = (tx: Tx, eventId: string): boolean => {
  const event = tx.select().from(events).where(eq(events.id, eventId)).get();

  return !!event && seatsTaken(tx, eventId) >= event.maxParticipants;
};

const statusPatch = (reg: Registration, next: RegistrationStatus): Partial<Registration> => {
  const now = new Date().toISOString();

  return {
    status: next,
    cancelledAt: next === 'cancelled' ? (reg.status === 'cancelled' ? reg.cancelledAt : now) : null,
    // The waitlist is a queue: whoever is moved onto it joins at the end.
    ...(next === 'waitlist' && reg.status !== 'waitlist' && { registeredAt: now }),
  };
};

const applyStatus = (regId: string, next: RegistrationStatus, overbook: boolean) =>
  db.transaction(
    (tx): StatusChange & { previous?: Registration } => {
      const reg = tx.select().from(registrations).where(eq(registrations.id, regId)).get();

      if (!reg || reg.deleted) return { ok: false, reason: 'not-found' };

      const takesSeat = !holdsSeatStatus(reg.status) && holdsSeatStatus(next);

      if (takesSeat && !overbook && isFull(tx, reg.eventId)) return { ok: false, reason: 'full' };

      const registration = tx
        .update(registrations)
        .set(statusPatch(reg, next))
        .where(eq(registrations.id, regId))
        .returning()
        .get();

      return { ok: true, registration, previousStatus: reg.status, previous: reg };
    },
    { behavior: 'immediate' },
  );

export const changeRegistrationStatus = async (
  regId: string,
  newStatus: RegistrationStatus,
  opts: { overbook?: boolean } = {},
): Promise<StatusChange> => {
  const { previous, ...change } = applyStatus(regId, newStatus, opts.overbook ?? false);

  if (!change.ok || !previous) return change;

  if (previous.status !== 'cancelled' && newStatus === 'cancelled') {
    const event = await getEventById(previous.eventId);
    const participant = await participantById(previous.participantId);

    if (event && event.listmonkListId > 0 && participant) {
      void removeFromList(participant.email, event.listmonkListId).catch(() => {});
    }
  }

  await reconcileSeats(previous.eventId, { skip: newStatus === 'waitlist' ? regId : undefined });

  return change;
};

/** Removes a registration and gives its seat to the waitlist. */
export const softDeleteRegistration = async (regId: string): Promise<boolean> => {
  const [removed] = await db
    .update(registrations)
    .set({ deleted: new Date().toISOString() })
    .where(and(eq(registrations.id, regId), isNull(registrations.deleted)))
    .returning({ eventId: registrations.eventId });

  if (!removed) return false;

  await reconcileSeats(removed.eventId);

  return true;
};

export const broadcastEventMessage = async (
  eventId: string,
  subject: string,
  content: string,
): Promise<{ sent: number; total: number }> => {
  const event = await getEventById(eventId);

  if (!event) return { sent: 0, total: 0 };

  const recipients = await db
    .select({ participant: participants })
    .from(registrations)
    .innerJoin(participants, eq(registrations.participantId, participants.id))
    .where(
      and(eq(registrations.eventId, eventId), isNull(registrations.deleted), eq(registrations.status, 'registered')),
    );

  const results = await settleWithConcurrency(recipients, ({ participant }) =>
    sendEventMessage(event, participant, subject, content),
  );

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length;

  return { sent, total: recipients.length };
};

export interface ResendResult {
  sent: number;
  failed: number;
  skipped: number;
}

/** Re-sends missing confirmations for live registered/waitlist seats only. */
export const resendRegistrationConfirmations = async (
  eventId: string,
  opts: { ids?: string[]; onlyMissing?: boolean } = {},
): Promise<ResendResult> => {
  const event = await getEventById(eventId);

  if (!event) return { sent: 0, failed: 0, skipped: 0 };

  const wanted = opts.ids?.length ? new Set(opts.ids) : null;

  const rows = await db
    .select({ registration: registrations, participant: participants })
    .from(registrations)
    .innerJoin(participants, eq(registrations.participantId, participants.id))
    .where(and(eq(registrations.eventId, eventId), isNull(registrations.deleted)))
    .orderBy(asc(registrations.registeredAt));

  const selected = rows.filter(({ registration }) => !wanted || wanted.has(registration.id));

  // flatMap, not filter: the guard narrows `status` to what the mailer accepts.
  const eligible = selected.flatMap(({ registration, participant }) => {
    const { id, status, confirmationSentAt } = registration;

    if (status !== 'registered' && status !== 'waitlist') return [];

    if (opts.onlyMissing && confirmationSentAt) return [];

    return [{ id, status, participant }];
  });

  const results = await withSubscriberScope(() =>
    settleWithConcurrency(eligible, async ({ id, status, participant }) => {
      const ok = await sendRegistrationConfirmation(event, participant, status, id);

      if (ok) await markConfirmationSent(id);

      return ok;
    }),
  );

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length;

  return { sent, failed: results.length - sent, skipped: selected.length - eligible.length };
};

export type SelfCancelResult = 'cancelled' | 'already' | 'not-found';

/** Cancels a registration from its signed link; only the first call cancels. */
export const cancelOwnRegistration = async (regId: string): Promise<SelfCancelResult> => {
  const reg = (await db.select().from(registrations).where(eq(registrations.id, regId)).limit(1))[0];

  if (!reg || reg.deleted) return 'not-found';

  if (reg.status === 'cancelled' || reg.status === 'attended') return 'already';

  const change = await changeRegistrationStatus(regId, 'cancelled');

  if (!change.ok) return 'not-found';

  return change.previousStatus === 'cancelled' ? 'already' : 'cancelled';
};

/** What the cancel page shows about the registration its link names. */
export const readRegistrationForCancel = async (
  regId: string,
): Promise<{ status: RegistrationStatus; firstName: string; event: Event } | null> => {
  const row = (
    await db
      .select({ registration: registrations, participant: participants, event: events })
      .from(registrations)
      .innerJoin(participants, eq(registrations.participantId, participants.id))
      .innerJoin(events, eq(registrations.eventId, events.id))
      .where(and(eq(registrations.id, regId), isNull(registrations.deleted), isNull(events.deleted)))
      .limit(1)
  )[0];

  return row ? { status: row.registration.status, firstName: row.participant.firstName, event: row.event } : null;
};
