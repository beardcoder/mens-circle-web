/**
 * Migrate data from a PocketBase database into the new Drizzle/SQLite store.
 *
 * The previous backend was PocketBase (its own embedded SQLite). This script
 * reads the records straight out of a PocketBase `data.db` file and upserts them
 * into the new schema (src/lib/server/db/schema.ts). It is idempotent: the
 * original 15-char PocketBase record IDs are preserved, so relations line up and
 * re-running updates in place instead of duplicating.
 *
 * Usage:
 *   # target DB = the app's SQLite file (defaults to ./data/mens-circle.db)
 *   DATABASE_PATH=./data/mens-circle.db \
 *     bun run scripts/import-pocketbase.ts /path/to/pb_data/data.db
 *
 * Notes:
 *   • Stop PocketBase (or copy the file) before importing — reading a live
 *     WAL database can miss the most recent writes.
 *   • Event images are NOT migrated (PocketBase stored them as files outside the
 *     row); `image_url` is left null. Set a URL later in the admin UI if needed.
 *   • Newsletter subscribers are not touched — they live in listmonk.
 */
import { Database } from 'bun:sqlite';

const SOURCE = process.argv[2];
if (!SOURCE) {
  console.error('Usage: bun run scripts/import-pocketbase.ts <path-to-pocketbase/data.db>');
  process.exit(1);
}

// The target DB is opened (and migrated) by the app's db module, which reads
// DATABASE_PATH. Import it dynamically so the env is in place first.
process.env.DATABASE_PATH ||= './data/mens-circle.db';

const { db } = await import('../src/lib/server/db/index.ts');
const { participants, events, registrations, testimonials } = await import('../src/lib/server/db/schema.ts');

// ── Coercion helpers ─────────────────────────────────────────────────────────
const text = (v: unknown): string => (v == null ? '' : String(v));
const bool = (v: unknown): boolean => v === 1 || v === '1' || v === true || v === 'true';
const numOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const intOr = (v: unknown, fallback: number): number => {
  const n = numOrNull(v);
  return n == null ? fallback : Math.trunc(n);
};
/** Normalise a PocketBase date string ("YYYY-MM-DD HH:MM:SS.sssZ") to ISO, or null. */
const iso = (v: unknown): string | null => {
  const s = text(v).trim();
  if (!s) return null;
  const d = new Date(s.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const time = (v: unknown): string => text(v).slice(0, 5); // "HH:MM"

// PocketBase stores soft-deletes as a non-empty `deleted` date.
const isDeleted = (row: Record<string, unknown>): boolean => !!text(row.deleted).trim();

// ── Source ───────────────────────────────────────────────────────────────────
const src = new Database(SOURCE, { readonly: true });

function rows(table: string): Array<Record<string, unknown>> {
  try {
    return src.query(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>;
  } catch (err) {
    console.warn(`  ⚠ could not read table "${table}": ${String(err)}`);
    return [];
  }
}

async function importTable<T extends { id: string }>(
  label: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  source: Array<Record<string, unknown>>,
  map: (r: Record<string, unknown>) => T | null,
): Promise<void> {
  let ok = 0;
  let skipped = 0;
  for (const r of source) {
    const mapped = map(r);
    if (!mapped) {
      skipped++;
      continue;
    }
    try {
      const rest = { ...mapped } as Record<string, unknown>;
      delete rest.id;
      await db.insert(table).values(mapped).onConflictDoUpdate({ target: table.id, set: rest });
      ok++;
    } catch (err) {
      console.warn(`  ⚠ ${label}/${mapped.id}: ${String(err)}`);
      skipped++;
    }
  }
  console.log(`✓ ${label}: ${ok} importiert, ${skipped} übersprungen (von ${source.length})`);
}

// ── Run (dependency order: participants + events → registrations) ────────────
console.log(`Import aus PocketBase: ${SOURCE}\n→ Ziel: ${process.env.DATABASE_PATH}\n`);

const importedParticipants = new Set<string>();
const importedEvents = new Set<string>();

await importTable('participants', participants, rows('participants'), (r) => {
  const id = text(r.id);
  if (!id) return null;
  importedParticipants.add(id);
  return {
    id,
    firstName: text(r.first_name),
    lastName: text(r.last_name),
    email: text(r.email).trim().toLowerCase(),
    phone: text(r.phone),
    createdAt: iso(r.created) ?? new Date().toISOString(),
    updatedAt: iso(r.updated) ?? new Date().toISOString(),
  };
});

await importTable('events', events, rows('events'), (r) => {
  if (isDeleted(r)) return null;
  const id = text(r.id);
  if (!id) return null;
  const eventDate = iso(r.event_date) ?? iso(r.slug);
  if (!eventDate) return null;
  importedEvents.add(id);
  return {
    id,
    title: text(r.title),
    slug: text(r.slug) || `event-${id}`,
    description: text(r.description),
    eventDate,
    startTime: time(r.start_time),
    endTime: time(r.end_time),
    location: text(r.location),
    locationDetails: text(r.location_details),
    street: text(r.street),
    postalCode: text(r.postal_code),
    city: text(r.city),
    latitude: numOrNull(r.latitude),
    longitude: numOrNull(r.longitude),
    maxParticipants: intOr(r.max_participants, 8),
    costBasis: text(r.cost_basis),
    isPublished: bool(r.is_published),
    imageUrl: null, // PocketBase file uploads are not migrated
    listmonkListId: intOr(r.listmonk_list_id, 0),
    deleted: null,
    createdAt: iso(r.created) ?? new Date().toISOString(),
    updatedAt: iso(r.updated) ?? new Date().toISOString(),
  };
});

await importTable('testimonials', testimonials, rows('testimonials'), (r) => {
  if (isDeleted(r)) return null;
  const id = text(r.id);
  if (!id) return null;
  return {
    id,
    quote: text(r.quote).slice(0, 1000),
    authorName: text(r.author_name),
    email: text(r.email).trim().toLowerCase(),
    role: text(r.role),
    isPublished: bool(r.is_published),
    publishedAt: iso(r.published_at),
    sortOrder: intOr(r.sort_order, 0),
    deleted: null,
    createdAt: iso(r.created) ?? new Date().toISOString(),
    updatedAt: iso(r.updated) ?? new Date().toISOString(),
  };
});

const VALID_STATUS = new Set(['registered', 'waitlist', 'cancelled', 'attended']);
await importTable('registrations', registrations, rows('registrations'), (r) => {
  if (isDeleted(r)) return null;
  const id = text(r.id);
  const participantId = text(r.participant);
  const eventId = text(r.event);
  // Skip dangling relations (e.g. the event was deleted / not imported).
  if (!id || !importedParticipants.has(participantId) || !importedEvents.has(eventId)) return null;
  const status = VALID_STATUS.has(text(r.status)) ? text(r.status) : 'registered';
  return {
    id,
    participantId,
    eventId,
    status,
    registeredAt: iso(r.registered_at) ?? iso(r.created),
    cancelledAt: iso(r.cancelled_at),
    reminderSentAt: iso(r.reminder_sent_at),
    smsReminderSentAt: iso(r.sms_reminder_sent_at),
    deleted: null,
    createdAt: iso(r.created) ?? new Date().toISOString(),
    updatedAt: iso(r.updated) ?? new Date().toISOString(),
  };
});

console.log('\nFertig.');
process.exit(0);
