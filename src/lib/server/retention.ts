/* eslint-disable no-console */
/**
 * Data minimisation, run daily by scripts/schedule.ts. `RETENTION_DAYS` after an
 * event's day:
 * - its listmonk list is deleted;
 * - every participant without a registration for a later event is anonymised (name,
 *   phone and address gone; the row stays so past events keep their counts) and
 *   removed from listmonk unless they subscribed to the newsletter;
 * - what a sign-up typed differently (`submitted_*`) is cleared.
 * Testimonials lose their address that many days after publication; deleted ones
 * are removed for good. Nothing is anonymised while listmonk could not forget the
 * address: the next run tries again.
 */
import { and, eq, inArray, isNotNull, like, lt, not, sql } from 'drizzle-orm';

import { addDays, todayBerlin } from '../shared/time';
import { config } from './config';
import { db } from './db';
import { events, participants, registrations, testimonials } from './db/schema';
import { deleteList, forgetSubscriber } from './listmonk';

const ANONYMOUS_DOMAIN = '@anonymised.invalid';
const DAY_MS = 86_400_000;

export interface RetentionResult {
  lists: number;
  participants: number;
  testimonials: number;
}

const deleteExpiredLists = async (cutoff: string): Promise<number> => {
  const expired = await db
    .select({ id: events.id, listId: events.listmonkListId })
    .from(events)
    .where(and(lt(events.eventDate, cutoff), sql`${events.listmonkListId} > 0`));

  let deleted = 0;

  for (const { id, listId } of expired) {
    if (!(await deleteList(listId))) continue;

    await db.update(events).set({ listmonkListId: 0 }).where(eq(events.id, id));
    deleted++;
  }

  return deleted;
};

/** Participants with no registration for an event on or after `cutoff`, not yet anonymised. */
const expiredParticipants = (cutoff: string) =>
  db
    .select({ id: participants.id, email: participants.email })
    .from(participants)
    .where(
      and(
        not(like(participants.email, `%${ANONYMOUS_DOMAIN}`)),
        sql`not exists (select 1 from ${registrations} join ${events} on ${events.id} = ${registrations.eventId}
          where ${registrations.participantId} = ${participants.id} and ${events.eventDate} >= ${cutoff})`,
      ),
    );

const anonymiseParticipants = async (cutoff: string): Promise<number> => {
  let done = 0;

  for (const person of await expiredParticipants(cutoff)) {
    if (!(await forgetSubscriber(person.email))) {
      console.error('[retention] listmonk could not forget a participant; retrying tomorrow', person.id);
      continue;
    }

    await db
      .update(participants)
      .set({ email: `${person.id}${ANONYMOUS_DOMAIN}`, firstName: '', lastName: '', phone: '' })
      .where(eq(participants.id, person.id));
    done++;
  }

  const expiredEvents = db.select({ id: events.id }).from(events).where(lt(events.eventDate, cutoff));

  await db
    .update(registrations)
    .set({ submittedFirstName: null, submittedLastName: null, submittedPhone: null })
    .where(inArray(registrations.eventId, expiredEvents));

  return done;
};

const minimiseTestimonials = async (before: string): Promise<number> => {
  const cleared = await db
    .update(testimonials)
    .set({ email: '' })
    .where(
      and(
        eq(testimonials.isPublished, true),
        isNotNull(testimonials.publishedAt),
        lt(testimonials.publishedAt, before),
        not(eq(testimonials.email, '')),
      ),
    )
    .returning({ id: testimonials.id });

  const removed = await db
    .delete(testimonials)
    .where(and(isNotNull(testimonials.deleted), lt(testimonials.deleted, before)))
    .returning({ id: testimonials.id });

  return cleared.length + removed.length;
};

export async function runRetention(now: Date = new Date(), days = config.RETENTION_DAYS): Promise<RetentionResult> {
  // Events before this Berlin day are past their retention.
  const cutoff = addDays(todayBerlin(now), -days);
  const before = new Date(now.getTime() - days * DAY_MS).toISOString();

  const result = {
    lists: await deleteExpiredLists(cutoff),
    participants: await anonymiseParticipants(cutoff),
    testimonials: await minimiseTestimonials(before),
  };

  console.info('[retention]', JSON.stringify(result));

  return result;
}

/** For tests and the admin: whether a stored address is an anonymised placeholder. */
export const isAnonymised = (email: string): boolean => email.endsWith(ANONYMOUS_DOMAIN);
