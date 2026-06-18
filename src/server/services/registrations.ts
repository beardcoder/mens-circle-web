/**
 * Registration service — the load-bearing capacity/waitlist decision flow and
 * the cancellation→promotion logic, ported verbatim from
 * `routes_event_register.pb.js` + `registrations.pb.js`. Pure domain logic that
 * emits {@link DomainEvent}s; the emails are sent by the notifier's handler.
 */
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { DB } from '../db';
import { newId } from '../db/id';
import {
  events as eventsTable,
  type ParticipantRow,
  participants,
  type RegistrationStatus,
  registrations,
} from '../db/schema';
import type { MailParticipant } from '../mail/templates';
import type { Notifier } from '../notifications';
import type { NewsletterPort } from '../ports';
import { type EventService, isEventPast } from './events';

export type RegisterInput = {
  eventId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type RegisterResult =
  | { ok: true; status: 'registered' | 'waitlist'; message: string }
  | { ok: false; code: 404 | 410 | 409 | 422; message: string };

const toMailParticipant = (p: ParticipantRow): MailParticipant => ({
  firstName: p.firstName,
  lastName: p.lastName,
  email: p.email,
  phone: p.phone,
});

export function createRegistrationService(
  db: DB,
  events: EventService,
  notifier: Notifier,
  newsletter: NewsletterPort,
) {
  async function upsertParticipant(
    email: string,
    fields: { first_name: string; last_name: string; phone: string },
  ): Promise<ParticipantRow> {
    const existing = await db
      .select()
      .from(participants)
      .where(eq(participants.email, email))
      .limit(1);

    if (existing[0]) {
      const patch: Partial<ParticipantRow> = { updated: new Date() };
      if (fields.first_name) patch.firstName = fields.first_name;
      if (fields.last_name) patch.lastName = fields.last_name;
      if (fields.phone) patch.phone = fields.phone;
      await db
        .update(participants)
        .set(patch)
        .where(eq(participants.id, existing[0].id));
      return { ...existing[0], ...patch } as ParticipantRow;
    }

    const now = new Date();
    const rows = await db
      .insert(participants)
      .values({
        id: newId(),
        email,
        firstName: fields.first_name || null,
        lastName: fields.last_name || null,
        phone: fields.phone || null,
        created: now,
        updated: now,
      })
      .returning();
    return rows[0];
  }

  async function register(input: RegisterInput): Promise<RegisterResult> {
    const notAvailable: RegisterResult = {
      ok: false,
      code: 404,
      message: 'Diese Veranstaltung ist nicht verfügbar.',
    };
    const event = await events.getById(input.eventId);
    if (!event) return notAvailable;
    if (!event.isPublished || event.deleted != null) return notAvailable;
    if (isEventPast(event.eventDate)) {
      return {
        ok: false,
        code: 410,
        message:
          'Diese Veranstaltung hat bereits stattgefunden. Eine Anmeldung ist nicht mehr möglich.',
      };
    }

    const activeBefore = await events.countActive(event.id);
    const isWaitlist = activeBefore >= event.maxParticipants;
    const status: RegistrationStatus = isWaitlist ? 'waitlist' : 'registered';

    const participant = await upsertParticipant(input.email, {
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
    });

    const existingRows = await db
      .select()
      .from(registrations)
      .where(
        and(
          eq(registrations.participant, participant.id),
          eq(registrations.event, event.id),
        ),
      )
      .limit(1);
    const existing = existingRows[0] ?? null;

    if (existing && !existing.deleted) {
      return {
        ok: false,
        code: 409,
        message:
          existing.status === 'waitlist'
            ? 'Du bist bereits auf der Warteliste für diese Veranstaltung.'
            : 'Du bist bereits für diese Veranstaltung angemeldet.',
      };
    }

    const now = new Date();
    if (existing) {
      await db
        .update(registrations)
        .set({
          status,
          registeredAt: now,
          cancelledAt: null,
          deleted: null,
          updated: now,
        })
        .where(eq(registrations.id, existing.id));
    } else {
      await db.insert(registrations).values({
        id: newId(),
        participant: participant.id,
        event: event.id,
        status,
        registeredAt: now,
        created: now,
        updated: now,
      });
    }

    const activeCount = await events.countActive(event.id);
    await notifier.emit({
      type: 'registration.created',
      event,
      participant: toMailParticipant(participant),
      status,
      activeCount,
    });

    // Best-effort per-event listmonk list assignment. Never blocks the response.
    try {
      const listId = await newsletter.ensureEventList(event);
      if (listId) {
        // Persist a freshly created list id on the event (ensureEventList only
        // creates it in listmonk; the source of truth lives here).
        if (event.listmonkListId !== listId) {
          await db
            .update(eventsTable)
            .set({ listmonkListId: listId, updated: new Date() })
            .where(eq(eventsTable.id, event.id));
        }
        const fullName = `${input.firstName} ${input.lastName}`.trim();
        await newsletter.addToLists(input.email, fullName, [listId], true);
      }
    } catch (err) {
      console.error('[register] listmonk assignment failed', String(err));
    }

    const message = isWaitlist
      ? `Du wurdest auf die Warteliste eingetragen, ${input.firstName}. Wir benachrichtigen dich per E-Mail, sobald ein Platz frei wird.`
      : `Vielen Dank, ${input.firstName}! Deine Anmeldung war erfolgreich. Du erhältst in Kürze eine Bestätigung per E-Mail.`;
    return { ok: true, status, message };
  }

  /**
   * Set a registration's status (admin). On a transition *to* cancelled the
   * oldest waitlisted registration for the same event is promoted (FIFO) and
   * emailed, and the participant is dropped from the event's listmonk list.
   */
  async function setStatus(
    regId: string,
    newStatus: RegistrationStatus,
  ): Promise<void> {
    const rows = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, regId))
      .limit(1);
    const reg = rows[0];
    if (!reg) return;
    const oldStatus = reg.status;

    const now = new Date();
    await db
      .update(registrations)
      .set({
        status: newStatus,
        ...(newStatus === 'cancelled' ? { cancelledAt: now } : {}),
        updated: now,
      })
      .where(eq(registrations.id, regId));

    if (oldStatus !== 'cancelled' && newStatus === 'cancelled') {
      await onCancelled(reg.event, reg.participant);
    }
  }

  async function onCancelled(
    eventId: string,
    participantId: string,
  ): Promise<void> {
    const event = await events.getById(eventId);
    if (!event) return;

    // Mirror in listmonk: drop from this event's list (best-effort).
    if (event.listmonkListId && event.listmonkListId > 0) {
      try {
        const p = await db
          .select()
          .from(participants)
          .where(eq(participants.id, participantId))
          .limit(1);
        if (p[0])
          await newsletter.removeFromList(p[0].email, event.listmonkListId);
      } catch (err) {
        console.error('[cancel] listmonk remove failed', String(err));
      }
    }

    // Promote the oldest waitlisted registration (FIFO by registered_at).
    const candidates = await db
      .select()
      .from(registrations)
      .where(
        and(
          eq(registrations.event, eventId),
          eq(registrations.status, 'waitlist'),
          isNull(registrations.deleted),
        ),
      )
      .orderBy(asc(registrations.registeredAt))
      .limit(1);
    const next = candidates[0];
    if (!next) return;

    await db
      .update(registrations)
      .set({
        status: 'registered',
        registeredAt: new Date(),
        updated: new Date(),
      })
      .where(eq(registrations.id, next.id));

    const p = await db
      .select()
      .from(participants)
      .where(eq(participants.id, next.participant))
      .limit(1);
    if (p[0]) {
      await notifier.emit({
        type: 'registration.promoted',
        event,
        participant: toMailParticipant(p[0]),
      });
    }
  }

  /** All registrations for an event, joined with participant details (admin). */
  async function listForEvent(eventId: string) {
    return db
      .select({
        id: registrations.id,
        status: registrations.status,
        registeredAt: registrations.registeredAt,
        deleted: registrations.deleted,
        firstName: participants.firstName,
        lastName: participants.lastName,
        email: participants.email,
        phone: participants.phone,
      })
      .from(registrations)
      .innerJoin(participants, eq(registrations.participant, participants.id))
      .where(eq(registrations.event, eventId))
      .orderBy(asc(registrations.registeredAt));
  }

  return { register, setStatus, listForEvent, upsertParticipant };
}

export type RegistrationService = ReturnType<typeof createRegistrationService>;
