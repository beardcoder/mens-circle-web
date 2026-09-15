/* eslint-disable no-console */
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { RegistrationPayload } from '../types';
import { settleWithConcurrency } from './concurrency';
import { db } from './db';
import type { Event, Participant, Registration, RegistrationStatus } from './db/schema';
import { participants, registrations } from './db/schema';
import {
  accepted,
  consented,
  type FormResult,
  INVALID_EMAIL,
  isHoneypotFilled,
  MISSING_CONSENT,
  rejected,
} from './form-submission';
import { sendEventMessage, sendRegistrationEmails, sendWaitlistPromotion } from './email';
import { countActiveRegistrations, ensureEventList, getEventById, isEventPast } from './events';
import { addToLists, removeFromList, withSubscriberScope } from './listmonk';

/** Alias kept for the existing call sites; the union lives with the column. */
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

interface RegistrationFields {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  eventId: string;
}

const readFields = (payload: RegistrationPayload): RegistrationFields => ({
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
 * Take the seat: revive the participant's cancelled registration or write a new
 * one. Returns the conflict to answer with when he already holds a live one.
 */
const claimSeat = async (participantId: string, eventId: string, status: IntakeStatus): Promise<FormResult | null> => {
  const existing = (
    await db
      .select()
      .from(registrations)
      .where(and(eq(registrations.participantId, participantId), eq(registrations.eventId, eventId)))
      .limit(1)
  )[0];

  if (existing && !existing.deleted) {
    return rejected(
      409,
      existing.status === 'waitlist'
        ? 'Du bist bereits auf der Warteliste für diese Veranstaltung.'
        : 'Du bist bereits für diese Veranstaltung angemeldet.',
    );
  }

  const registeredAt = new Date().toISOString();
  if (existing) {
    await db
      .update(registrations)
      .set({ status, registeredAt, cancelledAt: null, deleted: null })
      .where(eq(registrations.id, existing.id));
  } else {
    await db.insert(registrations).values({ participantId, eventId, status, registeredAt });
  }
  return null;
};

const assignToEventList = async (event: Event, fields: RegistrationFields): Promise<void> => {
  const listId = await ensureEventList(event);
  if (!listId) return;
  const result = await addToLists(fields.email, `${fields.firstName} ${fields.lastName}`.trim(), [listId], true);
  if (!result.ok) throw new Error('listmonk assignment rejected');
};

/**
 * Confirmation mail and event-list membership, once the seat is already booked.
 *
 * Deliberately not awaited: the visitor gets his answer the moment the row is
 * written, and neither a slow mailer nor a listmonk outage may turn a booked
 * seat into an error page. Both halves run inside one subscriber scope so they
 * provision the same listmonk identity instead of racing to create it twice.
 */
const dispatchSideEffects = (
  event: Event,
  participant: Participant,
  fields: RegistrationFields,
  status: IntakeStatus,
  activeCount: number,
): void => {
  fireAndForget(
    '[registrations] side effects failed',
    withSubscriberScope(async () => {
      const tasks: Array<[string, Promise<unknown>]> = [
        ['emails', sendRegistrationEmails(event, participant, status, activeCount)],
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

export const register = async (payload: RegistrationPayload): Promise<FormResult> => {
  const fields = readFields(payload);
  const confirmation = confirmationMessage(fields.firstName);

  if (isHoneypotFilled(payload.website)) return accepted(confirmation);

  if (!consented(payload.privacy)) return rejected(422, MISSING_CONSENT);
  if (!fields.email.includes('@')) return rejected(422, INVALID_EMAIL);
  if (!fields.eventId) return rejected(422, 'Es wurde keine Veranstaltung angegeben.');

  const found = await openEvent(fields.eventId);
  if ('error' in found) return found.error;
  const { event } = found;

  const isWaitlist = (await countActiveRegistrations(event.id)) >= event.maxParticipants;
  const status: IntakeStatus = isWaitlist ? 'waitlist' : 'registered';

  const participant = await upsertParticipant(fields.email, fields);
  const conflict = await claimSeat(participant.id, event.id, status);
  if (conflict) return conflict;

  dispatchSideEffects(event, participant, fields, status, await countActiveRegistrations(event.id));

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
