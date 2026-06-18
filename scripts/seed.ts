/**
 * Seed a single published sample event so a fresh database renders the public
 * /event page out of the box (mirrors the former PocketBase sample-event seed).
 * Idempotent: skips if any event already exists.
 *
 *   bun run scripts/seed.ts
 */
import { getDb } from '../src/server/db';
import { newId } from '../src/server/db/id';
import { events } from '../src/server/db/schema';

const db = getDb();
const existing = await db.select({ id: events.id }).from(events).limit(1);
if (existing.length > 0) {
  console.log('→ events already present — skipping seed');
  process.exit(0);
}

const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
const date = new Date(
  Date.UTC(
    in14Days.getUTCFullYear(),
    in14Days.getUTCMonth(),
    in14Days.getUTCDate(),
    19,
    0,
    0,
  ),
);

await db.insert(events).values({
  id: newId(),
  title: 'Männerkreis Straubing',
  slug: date.toISOString().slice(0, 10),
  description:
    'Ein Abend für ehrliche Begegnung, Austausch und Stille unter Männern.\n\nWir treffen uns in einem geschützten Rahmen.',
  eventDate: date,
  startTime: '19:00',
  endTime: '21:30',
  location: 'Straubing',
  locationDetails: 'Der genaue Treffpunkt wird nach der Anmeldung mitgeteilt.',
  maxParticipants: 8,
  costBasis: 'Auf Spendenbasis',
  isPublished: true,
  created: new Date(),
  updated: new Date(),
});

console.log('✓ seeded sample event');
process.exit(0);
