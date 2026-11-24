/**
 * One-off move from the old Drizzle database to EmDash: reads `mens-circle.db` and
 * writes a seed with its events, the registrations of upcoming events and the
 * voices (without their addresses). Apply it to the EmDash database afterwards:
 *
 *   bun scripts/migrate-to-emdash.ts /data/mens-circle.db /data/migration.json
 *   bunx --bun emdash seed /data/migration.json --database /data/emdash.db --skip-media
 *
 * Cancelled, waitlisted and past registrations are left behind (no waiting list, and
 * past ones are due for deletion anyway). Deleted rows stay behind too. Plain-text
 * descriptions become Portable Text: blank lines part paragraphs, "- " lines a list.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Database } from 'bun:sqlite';

import { todayBerlin, zonedTime } from '../src/lib/shared/time';

type Row = Record<string, string | number | null>;

const [source = './data/mens-circle.db', target = './data/migration.json'] = process.argv.slice(2);
const db = new Database(source, { readonly: true });
const all = (sql: string): Row[] => db.query(sql).all() as Row[];

let key = 0;
const span = (text: string) => ({ _type: 'span', _key: `s${++key}`, text, marks: [] });

const LIST_ITEM = /^\s*[-–•*]\s+(.+)$/;

/** The old plain text as Portable Text blocks. */
export const toPortableText = (text: string): unknown[] =>
  text
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .flatMap((paragraph) => {
      const lines = paragraph
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length > 0 && lines.every((line) => LIST_ITEM.test(line))) {
        return lines.map((line) => ({
          _type: 'block',
          _key: `b${++key}`,
          style: 'normal',
          listItem: 'bullet',
          level: 1,
          markDefs: [],
          children: [span(LIST_ITEM.exec(line)![1])],
        }));
      }

      return lines.length
        ? [{ _type: 'block', _key: `b${++key}`, style: 'normal', markDefs: [], children: [span(lines.join('\n'))] }]
        : [];
    });

const day = (value: unknown): string => String(value ?? '').slice(0, 10);

const instant = (eventDate: unknown, time: unknown): string | undefined =>
  zonedTime(day(eventDate), String(time || '00:00'))?.date.toISOString();

const events = all('select * from events where deleted is null order by event_date').map((ev) => ({
  id: String(ev.id),
  slug: String(ev.slug),
  status: ev.is_published ? 'published' : 'draft',
  data: {
    title: ev.title,
    starts_at: instant(ev.event_date, ev.start_time),
    ...(ev.end_time ? { ends_at: instant(ev.event_date, ev.end_time) } : {}),
    description: toPortableText(String(ev.description ?? '')),
    max_participants: ev.max_participants,
    cost_basis: ev.cost_basis,
    location: ev.location,
    street: ev.street,
    postal_code: ev.postal_code,
    city: ev.city,
    location_details: ev.location_details,
    ...(ev.latitude !== null ? { latitude: ev.latitude } : {}),
    ...(ev.longitude !== null ? { longitude: ev.longitude } : {}),
  },
}));

const registrations = all(`
  select r.id, r.event_id, r.reminder_sent_at, p.first_name, p.last_name, p.email, p.phone
  from registrations r
  join participants p on p.id = r.participant_id
  join events e on e.id = r.event_id
  where r.deleted is null and e.deleted is null and r.status in ('registered', 'attended')
    and e.event_date >= '${todayBerlin()}'
`).map((reg) => ({
  id: String(reg.id),
  status: 'published',
  data: {
    first_name: reg.first_name || '–',
    last_name: reg.last_name || '–',
    email: reg.email,
    phone: reg.phone,
    event: `$ref:${reg.event_id}`,
    ...(reg.reminder_sent_at ? { reminder_sent_at: reg.reminder_sent_at } : {}),
  },
}));

const testimonials = all('select * from testimonials where deleted is null order by sort_order, created_at').map(
  (t) => ({
    id: String(t.id),
    status: t.is_published ? 'published' : 'draft',
    data: { quote: t.quote, name: t.author_name, role: t.role },
  }),
);

// The collections travel along (applied with `skip`, so nothing changes): the validator
// needs them to know that registrations and voices take no slug, and slugless entries
// keep their old ids, so the cancel links in mails already sent keep working.
const { collections } = JSON.parse(readFileSync(new URL('../seed/seed.json', import.meta.url), 'utf8'));

writeFileSync(
  target,
  JSON.stringify({ version: '1', collections, content: { events, registrations, testimonials } }, null, 2),
);

console.info(
  `[migrate] ${events.length} events, ${registrations.length} registrations, ${testimonials.length} voices → ${target}`,
);
