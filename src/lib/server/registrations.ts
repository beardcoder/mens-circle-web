/* eslint-disable no-console */
import { and, asc, eq, isNull } from 'drizzle-orm';
import { settleWithConcurrency } from './concurrency';
import { db } from './db';
import type { Event, Participant, Registration, RegistrationStatus } from './db/schema';
import { participants, registrations } from './db/schema';
import { accepted, type FormResult, isHoneypotFilled, rejected } from './form-submission';
import { sendEventMessage, sendRegistrationConfirmation, sendRegistrationEmails, sendWaitlistPromotion } from './email';
import { countActiveRegistrations, ensureEventList, getEventById, isEventPast } from './events';
import { addToLists, removeFromList, withSubscriberScope } from './listmonk';

/** Alias for the existing call sites; the union lives with the column. */
export type RegStatus = RegistrationStatus;

/** The two statuses a fresh registration can be given; the rest are admin transitions. */
type IntakeStatus = Extract<RegStatus, 'registered' | 'waitlist'>;

const fireAndForget = (label: string, promise: Promise<unknown>): void => {
  void promise.catch((err) => console.error(label, String(err)));
};

const upsertParticipant = async (
  email: string,
  fields: { firstName?: string; lastName?: string; phone?: string },
): Promise<Participant> => {
  const existing = (await db.select().from(participants).where(eq(participants.email, email)).limit(1))[0];
  const patch: Partial<Participant> = {};
  if (fields.firstName) patch.firstName = fields.firstName;
  if (fields.lastName) patch.lastName = fields.lastName;
  if (fields.phone) patch.phone = fields.phone;

  if (existing) {
    if (Object.keys(patch).length > 0) {
      return (await db.update(participants).set(patch).where(eq(participants.id, existing.id)).returning())[0];
    }
    return existing;
  }
  return (
    await db
      .insert(participants)
      .values({ email, firstName: fields.firstName ?? '', lastName: fields.lastName ?? '', phone: fields.phone ?? '' })
      .returning()
  )[0];
};

/** The registration form, already validated by the `register` action's schema. */
export interface RegistrationInput {
  event_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string | null;
  /** Honeypot — real users leave it empty. */
  website?: string | null;
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

const confirmationMessage = (firstName: string): string =>
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
 * Take the seat: revive a cancelled registration or write a new one. Returns the
 * booked row's id, or the conflict to answer with when a live one exists.
 */
const claimSeat = async (
  participantId: string,
  eventId: string,
  status: IntakeStatus,
): Promise<{ registrationId: string } | { error: FormResult }> => {
  const existing = (
    await db
      .select()
      .from(registrations)
      .where(and(eq(registrations.participantId, participantId), eq(registrations.eventId, eventId)))
      .limit(1)
  )[0];

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

  const registeredAt = new Date().toISOString();
  if (existing) {
    // A revived seat starts over: the old confirmation no longer describes it.
    await db
      .update(registrations)
      .set({ status, registeredAt, cancelledAt: null, deleted: null, confirmationSentAt: null })
      .where(eq(registrations.id, existing.id));
    return { registrationId: existing.id };
  }
  const inserted = (
    await db.insert(registrations).values({ participantId, eventId, status, registeredAt }).returning()
  )[0];
  return { registrationId: inserted.id };
};

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

/**
 * Confirmation mail and list membership, after the seat is booked. Not awaited:
 * neither a slow mailer nor a listmonk outage may turn a booked seat into an
 * error page. Both halves share one subscriber scope so they provision the same
 * listmonk identity instead of racing to create it twice.
 */
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
      const mails = sendRegistrationEmails(event, participant, status, activeCount).then(async (userSent) => {
        if (userSent) await markConfirmationSent(registrationId);
        return userSent;
      });
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
  const confirmation = confirmationMessage(fields.firstName);

  if (isHoneypotFilled(payload.website)) return accepted(confirmation);

  const found = await openEvent(fields.eventId);
  if ('error' in found) return found.error;
  const { event } = found;

  const isWaitlist = (await countActiveRegistrations(event.id)) >= event.maxParticipants;
  const status: IntakeStatus = isWaitlist ? 'waitlist' : 'registered';

  const participant = await upsertParticipant(fields.email, fields);
  const seat = await claimSeat(participant.id, event.id, status);
  if ('error' in seat) return seat.error;

  dispatchSideEffects(
    event,
    participant,
    fields,
    status,
    await countActiveRegistrations(event.id),
    seat.registrationId,
  );

  return accepted(
    isWaitlist
      ? `Du wurdest auf die Warteliste eingetragen, ${fields.firstName}. Wir benachrichtigen dich per E-Mail, sobald ein Platz frei wird.`
      : confirmation,
  );
};

export interface RegistrationRow {
  id: string;
  status: RegStatus;
  registeredAt: string | null;
  cancelledAt: string | null;
  confirmationSentAt: string | null;
  reminderSentAt: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export const listRegistrationsForEvent = async (eventId: string): Promise<RegistrationRow[]> => {
  const rows = await db
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
    })
    .from(registrations)
    .innerJoin(participants, eq(registrations.participantId, participants.id))
    .where(and(eq(registrations.eventId, eventId), isNull(registrations.deleted)))
    .orderBy(asc(registrations.registeredAt));
  return rows;
};

const promoteNextWaitlisted = async (event: Event): Promise<void> => {
  const next = (
    await db
      .select()
      .from(registrations)
      .where(
        and(eq(registrations.eventId, event.id), eq(registrations.status, 'waitlist'), isNull(registrations.deleted)),
      )
      .orderBy(asc(registrations.registeredAt))
      .limit(1)
  )[0];
  if (!next) return;

  await db
    .update(registrations)
    .set({ status: 'registered', registeredAt: new Date().toISOString() })
    .where(eq(registrations.id, next.id));

  const participant = (await db.select().from(participants).where(eq(participants.id, next.participantId)).limit(1))[0];
  if (participant) {
    fireAndForget('[registrations] promotion email failed', sendWaitlistPromotion(event, participant));
  }
};

export const changeRegistrationStatus = async (regId: string, newStatus: RegStatus): Promise<Registration | null> => {
  const reg = (await db.select().from(registrations).where(eq(registrations.id, regId)).limit(1))[0];
  if (!reg) return null;
  const oldStatus = reg.status;

  const patch: Partial<Registration> = { status: newStatus };
  if (newStatus === 'cancelled') patch.cancelledAt = new Date().toISOString();
  const updated = (await db.update(registrations).set(patch).where(eq(registrations.id, regId)).returning())[0];

  if (oldStatus !== 'cancelled' && newStatus === 'cancelled') {
    const event = await getEventById(reg.eventId);
    if (event) {
      if (event.listmonkListId > 0) {
        const participant = (
          await db.select().from(participants).where(eq(participants.id, reg.participantId)).limit(1)
        )[0];
        if (participant) void removeFromList(participant.email, event.listmonkListId).catch(() => {});
      }
      await promoteNextWaitlisted(event);
    }
  }
  return updated;
};

export const softDeleteRegistration = async (regId: string): Promise<void> => {
  await db.update(registrations).set({ deleted: new Date().toISOString() }).where(eq(registrations.id, regId));
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

/**
 * Re-send confirmations listmonk never delivered. Only live `registered` and
 * `waitlist` seats are eligible — a cancelled or attended one would confirm
 * something no longer true — and each success re-stamps `confirmation_sent_at`.
 */
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
      const ok = await sendRegistrationConfirmation(event, participant, status);
      if (ok) await markConfirmationSent(id);
      return ok;
    }),
  );

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  return { sent, failed: results.length - sent, skipped: selected.length - eligible.length };
};
