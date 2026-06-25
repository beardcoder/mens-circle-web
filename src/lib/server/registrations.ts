/* eslint-disable no-console */
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { ApiResponse, RegistrationPayload } from '../types';
import { db } from './db';
import type { Event, Participant, Registration } from './db/schema';
import { participants, registrations } from './db/schema';
import { sendEventMessage, sendRegistrationEmails, sendWaitlistPromotion } from './email';
import { countActiveRegistrations, ensureEventList, getEventById, isEventPast } from './events';
import { addToLists, removeFromList } from './listmonk';

export type RegStatus = 'registered' | 'waitlist' | 'cancelled' | 'attended';

export interface RegisterResult {
  status: number;
  body: ApiResponse;
}

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

const truthy = (v: unknown): boolean => v === true || v === 'true' || v === 1 || v === '1';

export const register = async (payload: RegistrationPayload): Promise<RegisterResult> => {
  const firstName = (payload.first_name || '').trim();
  const lastName = (payload.last_name || '').trim();
  const email = (payload.email || '').trim().toLowerCase();
  const phone = (payload.phone_number || '').trim();
  const eventId = payload.event_id;

  if (typeof payload.website === 'string' && payload.website.trim() !== '') {
    return {
      status: 200,
      body: {
        success: true,
        message: `Vielen Dank, ${firstName}! Deine Anmeldung war erfolgreich. Du erhältst in Kürze eine Bestätigung per E-Mail.`,
      },
    };
  }

  if (!truthy(payload.privacy)) {
    return { status: 422, body: { success: false, message: 'Bitte bestätige die Datenschutzerklärung.' } };
  }
  if (!email || !email.includes('@')) {
    return { status: 422, body: { success: false, message: 'Bitte gib eine gültige E-Mail-Adresse an.' } };
  }
  if (!eventId) {
    return { status: 422, body: { success: false, message: 'Es wurde keine Veranstaltung angegeben.' } };
  }

  const event = await getEventById(eventId);
  if (!event || !event.isPublished || event.deleted) {
    return { status: 404, body: { success: false, message: 'Diese Veranstaltung ist nicht verfügbar.' } };
  }
  if (isEventPast(event)) {
    return {
      status: 410,
      body: {
        success: false,
        message: 'Diese Veranstaltung hat bereits stattgefunden. Eine Anmeldung ist nicht mehr möglich.',
      },
    };
  }

  const activeCount = await countActiveRegistrations(event.id);
  const isWaitlist = activeCount >= event.maxParticipants;
  const status: RegStatus = isWaitlist ? 'waitlist' : 'registered';

  const participant = await upsertParticipant(email, { firstName, lastName, phone });

  const existing = (
    await db
      .select()
      .from(registrations)
      .where(and(eq(registrations.participantId, participant.id), eq(registrations.eventId, event.id)))
      .limit(1)
  )[0];

  if (existing && !existing.deleted) {
    const msg =
      existing.status === 'waitlist'
        ? 'Du bist bereits auf der Warteliste für diese Veranstaltung.'
        : 'Du bist bereits für diese Veranstaltung angemeldet.';
    return { status: 409, body: { success: false, message: msg } };
  }

  const nowIso = new Date().toISOString();
  if (existing) {
    await db
      .update(registrations)
      .set({ status, registeredAt: nowIso, cancelledAt: null, deleted: null })
      .where(eq(registrations.id, existing.id));
  } else {
    await db
      .insert(registrations)
      .values({ participantId: participant.id, eventId: event.id, status, registeredAt: nowIso });
  }

  const freshCount = await countActiveRegistrations(event.id);
  fireAndForget('[registrations] emails failed', sendRegistrationEmails(event, participant, status, freshCount));
  fireAndForget(
    '[registrations] listmonk assignment failed',
    ensureEventList(event).then((listId) => {
      if (listId) return addToLists(email, `${firstName} ${lastName}`.trim(), [listId], true);
    }),
  );

  const message = isWaitlist
    ? `Du wurdest auf die Warteliste eingetragen, ${firstName}. Wir benachrichtigen dich per E-Mail, sobald ein Platz frei wird.`
    : `Vielen Dank, ${firstName}! Deine Anmeldung war erfolgreich. Du erhältst in Kürze eine Bestätigung per E-Mail.`;
  return { status: 200, body: { success: true, message } };
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
  return rows as RegistrationRow[];
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
  const oldStatus = reg.status as RegStatus;

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

  const results = await Promise.allSettled(
    recipients.map(({ participant }) => sendEventMessage(event, participant, subject, content)),
  );
  const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  return { sent, total: recipients.length };
};
