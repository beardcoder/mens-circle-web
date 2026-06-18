/**
 * Drizzle schema — the data model that PocketBase used to own, now expressed as
 * plain SQLite tables. Mirrors the former `pb_migrations/` collections:
 * `participants`, `events`, `registrations`, `testimonials`.
 *
 * Drizzle is the host-agnostic seam: this schema drives `bun:sqlite` today and
 * can be repointed at D1 / libSQL / Postgres later without touching the domain.
 *
 * Conventions:
 *  - `id` is a 15-char base62 string (PocketBase-compatible, see `db/id.ts`).
 *  - all timestamps are stored as integer epoch-millis (Drizzle `timestamp_ms`),
 *    surfaced as JS `Date`. Nullable date fields double as soft-delete markers.
 */
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const createdAt = integer('created', { mode: 'timestamp_ms' })
  .notNull()
  .default(sql`(unixepoch() * 1000)`);
const updatedAt = integer('updated', { mode: 'timestamp_ms' })
  .notNull()
  .default(sql`(unixepoch() * 1000)`);

/** Shared participants, deduped by unique email. PII — never publicly readable. */
export const participants = sqliteTable(
  'participants',
  {
    id: text('id').primaryKey(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    email: text('email').notNull(),
    phone: text('phone'),
    created: createdAt,
    updated: updatedAt,
  },
  (t) => [uniqueIndex('idx_participants_email').on(t.email)],
);

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    eventDate: integer('event_date', { mode: 'timestamp_ms' }).notNull(),
    startTime: text('start_time'),
    endTime: text('end_time'),
    location: text('location'),
    locationDetails: text('location_details'),
    street: text('street'),
    postalCode: text('postal_code'),
    city: text('city'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    maxParticipants: integer('max_participants').notNull().default(8),
    costBasis: text('cost_basis'),
    isPublished: integer('is_published', { mode: 'boolean' })
      .notNull()
      .default(false),
    image: text('image'),
    deleted: integer('deleted', { mode: 'timestamp_ms' }),
    listmonkListId: integer('listmonk_list_id'),
    created: createdAt,
    updated: updatedAt,
  },
  (t) => [uniqueIndex('idx_events_slug').on(t.slug)],
);

export const registrations = sqliteTable(
  'registrations',
  {
    id: text('id').primaryKey(),
    participant: text('participant')
      .notNull()
      .references(() => participants.id, { onDelete: 'cascade' }),
    event: text('event')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    // registered | waitlist | cancelled | attended
    status: text('status').notNull().default('registered'),
    registeredAt: integer('registered_at', { mode: 'timestamp_ms' }),
    cancelledAt: integer('cancelled_at', { mode: 'timestamp_ms' }),
    reminderSentAt: integer('reminder_sent_at', { mode: 'timestamp_ms' }),
    smsReminderSentAt: integer('sms_reminder_sent_at', {
      mode: 'timestamp_ms',
    }),
    deleted: integer('deleted', { mode: 'timestamp_ms' }),
    created: createdAt,
    updated: updatedAt,
  },
  (t) => [
    uniqueIndex('idx_registrations_participant_event').on(
      t.participant,
      t.event,
    ),
    index('idx_registrations_event_status').on(t.event, t.status),
  ],
);

export const testimonials = sqliteTable('testimonials', {
  id: text('id').primaryKey(),
  quote: text('quote').notNull(),
  authorName: text('author_name'),
  email: text('email'),
  role: text('role'),
  isPublished: integer('is_published', { mode: 'boolean' })
    .notNull()
    .default(false),
  publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
  sortOrder: integer('sort_order').notNull().default(0),
  deleted: integer('deleted', { mode: 'timestamp_ms' }),
  created: createdAt,
  updated: updatedAt,
});

export type EventRow = typeof events.$inferSelect;
export type ParticipantRow = typeof participants.$inferSelect;
export type RegistrationRow = typeof registrations.$inferSelect;
export type TestimonialRow = typeof testimonials.$inferSelect;

export const REGISTRATION_STATUSES = [
  'registered',
  'waitlist',
  'cancelled',
  'attended',
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];
