/**
 * Drizzle schema — the SQLite tables that replace the former PocketBase
 * collections (participants, events, registrations, testimonials).
 *
 * Conventions mirrored from the old PocketBase model:
 *   • Text UUID primary keys.
 *   • `deleted` is a soft-delete timestamp (ISO string) — null = live.
 *   • Timestamps are ISO-8601 strings (UTC), so they sort lexicographically.
 *   • Booleans are stored as integers (0/1).
 */
import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const uuid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

export const participants = sqliteTable(
  'participants',
  {
    id: text('id').primaryKey().$defaultFn(uuid),
    firstName: text('first_name').notNull().default(''),
    lastName: text('last_name').notNull().default(''),
    email: text('email').notNull(),
    phone: text('phone').notNull().default(''),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso).$onUpdateFn(nowIso),
  },
  (t) => [uniqueIndex('idx_participants_email').on(t.email)],
);

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey().$defaultFn(uuid),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull().default(''),
    eventDate: text('event_date').notNull(), // ISO timestamp (UTC)
    startTime: text('start_time').notNull().default(''), // "HH:MM"
    endTime: text('end_time').notNull().default(''), // "HH:MM"
    location: text('location').notNull().default(''),
    locationDetails: text('location_details').notNull().default(''),
    street: text('street').notNull().default(''),
    postalCode: text('postal_code').notNull().default(''),
    city: text('city').notNull().default(''),
    latitude: real('latitude'),
    longitude: real('longitude'),
    maxParticipants: integer('max_participants').notNull().default(8),
    costBasis: text('cost_basis').notNull().default(''),
    isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(false),
    imageUrl: text('image_url'),
    listmonkListId: integer('listmonk_list_id').notNull().default(0),
    deleted: text('deleted'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso).$onUpdateFn(nowIso),
  },
  (t) => [uniqueIndex('idx_events_slug').on(t.slug), index('idx_events_date').on(t.eventDate)],
);

export const registrations = sqliteTable(
  'registrations',
  {
    id: text('id').primaryKey().$defaultFn(uuid),
    participantId: text('participant_id')
      .notNull()
      .references(() => participants.id, { onDelete: 'cascade' }),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    // 'registered' | 'waitlist' | 'cancelled' | 'attended'
    status: text('status').notNull(),
    registeredAt: text('registered_at'),
    cancelledAt: text('cancelled_at'),
    reminderSentAt: text('reminder_sent_at'),
    smsReminderSentAt: text('sms_reminder_sent_at'),
    deleted: text('deleted'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso).$onUpdateFn(nowIso),
  },
  (t) => [
    uniqueIndex('idx_registrations_participant_event').on(t.participantId, t.eventId),
    index('idx_registrations_event').on(t.eventId),
  ],
);

export const testimonials = sqliteTable('testimonials', {
  id: text('id').primaryKey().$defaultFn(uuid),
  quote: text('quote').notNull(),
  authorName: text('author_name').notNull().default(''),
  email: text('email').notNull().default(''),
  role: text('role').notNull().default(''),
  isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(false),
  publishedAt: text('published_at'),
  sortOrder: integer('sort_order').notNull().default(0),
  deleted: text('deleted'),
  createdAt: text('created_at').notNull().$defaultFn(nowIso),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso).$onUpdateFn(nowIso),
});

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Participant = typeof participants.$inferSelect;
export type Registration = typeof registrations.$inferSelect;
export type Testimonial = typeof testimonials.$inferSelect;

// Re-export for migrations / drizzle-kit introspection convenience.
export const __sql = sql;
