/**
 * Import live data (Laravel CSV exports) into the new EmDash SQLite structure.
 *
 * Usage:
 *   DATABASE_PATH=./data/emdash.db bun run scripts/import-live-data.ts <csv-dir>
 *
 * Idempotent: records get deterministic 16-char hex IDs derived from their old
 * integer IDs, so re-running updates in place instead of duplicating. Relations
 * (registrations → participant/event, subscribers → participant) are resolved
 * through the same derivation.
 *
 * Maps the dynamic collections only. Static content (pages, content_blocks,
 * navigation_items, settings) already lives in the Astro JSON files.
 */
import { readFileSync } from 'node:fs';
import { getDb, nowISO } from '../server/db.ts';

const CSV_DIR = process.argv[2];

if (!CSV_DIR) {
  console.error('Usage: bun run scripts/import-live-data.ts <csv-dir>');
  process.exit(1);
}

type Row = Record<string, string>;
type Mapped = { id: string; data: Record<string, unknown> };

// ── RFC-4180 CSV parser (handles quotes, embedded commas/newlines, "" escapes) ─
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function readCsv(name: string): Row[] {
  const text = readFileSync(`${CSV_DIR}/${name}`, 'utf8');
  const rows = parseCsv(text).filter(
    (r) => r.length > 1 || (r.length === 1 && r[0] !== ''),
  );
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const obj: Row = {};
    header.forEach((h, i) => (obj[h] = r[i] ?? ''));
    return obj;
  });
}

// ── Field coercion ────────────────────────────────────────────────────────
function id(prefix: string, oldId: string): string {
  return (
    prefix +
    String(oldId)
      .trim()
      .padStart(16 - prefix.length, '0')
  ).slice(0, 16);
}
function date(v: string): string | null {
  const s = (v || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s + '.000Z';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s + ' 00:00:00.000Z';
  return s;
}
function bool(v: string): boolean {
  return ['true', '1', 't', 'yes'].includes((v || '').trim().toLowerCase());
}
function num(v: string): number | null {
  const s = (v || '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
// Trim + collapse internal whitespace (keeps original casing of real names).
function clean(v: string): string {
  return (v || '').replace(/\s+/g, ' ').trim();
}
// Source rows with a deleted_at timestamp were deleted in the old system — a
// clean import omits them (this drops the junk/test testimonials and any
// removed events instead of carrying soft-deleted cruft into the new DB).
function isDeleted(r: Row): boolean {
  return !!(r.deleted_at && r.deleted_at.trim());
}

// ── SQLite helpers ───────────────────────────────────────────────────────────

function upsertRow(
  table: string,
  recordId: string,
  data: Record<string, unknown>,
): boolean {
  const db = getDb();
  try {
    const existing = db
      .query(`SELECT id FROM ${table} WHERE id = ?`)
      .get(recordId);

    if (existing) {
      const keys = Object.keys(data);
      const setClause = keys.map((k) => `${k} = ?`).join(', ');
      const values = keys.map(
        (k) => (data[k] ?? null) as string | number | null,
      );
      db.query(
        `UPDATE ${table} SET ${setClause}, updated_at = ? WHERE id = ?`,
      ).run(...[...values, nowISO(), recordId]);
    } else {
      const allData: Record<string, unknown> = { id: recordId, ...data };
      const keys = Object.keys(allData);
      const placeholders = keys.map(() => '?').join(', ');
      const values = keys.map(
        (k) => (allData[k] ?? null) as string | number | null,
      );
      db.query(
        `INSERT INTO ${table} (${keys.join(', ')}, created_at, updated_at) VALUES (${placeholders}, ?, ?)`,
      ).run(...([...values, nowISO(), nowISO()] as (string | number | null)[]));
    }
    return true;
  } catch (e) {
    console.warn(`  ⚠ ${table}/${recordId}: ${String(e)}`);
    return false;
  }
}

// ── Importers (dependency order) ────────────────────────────────────────────
const importedParticipants = new Set<string>();
const importedEvents = new Set<string>();

function importCollection(
  label: string,
  file: string,
  table: string,
  map: (r: Row) => Mapped | null,
): void {
  const rows = readCsv(file);
  let ok = 0;
  let skipped = 0;
  for (const r of rows) {
    const mapped = map(r);
    if (!mapped) {
      skipped++;
      continue;
    }
    if (upsertRow(table, mapped.id, mapped.data)) ok++;
    else skipped++;
  }
  console.log(
    `✓ ${label}: ${ok} imported, ${skipped} skipped (of ${rows.length})`,
  );
}

function main(): void {
  console.log(`Importing from ${CSV_DIR} into SQLite\n`);

  // Ensure DB is initialized (migrations run on getDb())
  getDb();

  importCollection('participants', 'participants.csv', 'participants', (r) => {
    const pid = id('p', r.id);
    importedParticipants.add(pid);
    return {
      id: pid,
      data: {
        first_name: clean(r.first_name),
        last_name: clean(r.last_name),
        email: (r.email || '').trim().toLowerCase(),
        phone: clean(r.phone),
      },
    };
  });

  let imageSkips = 0;
  importCollection('events', 'events.csv', 'events', (r) => {
    if (isDeleted(r)) return null;
    const eid = id('e', r.id);
    importedEvents.add(eid);
    if (r.image) imageSkips++;
    return {
      id: eid,
      data: {
        title: clean(r.title),
        slug: r.slug || `event-${r.id}`,
        description: r.description || '',
        event_date: date(r.event_date) || date(r.slug) || '',
        start_time: r.start_time ? r.start_time.slice(0, 5) : '',
        end_time: r.end_time ? r.end_time.slice(0, 5) : '',
        location: clean(r.location),
        location_details: r.location_details || '',
        street: clean(r.street),
        postal_code: clean(r.postal_code),
        city: clean(r.city),
        latitude: num(r.latitude),
        longitude: num(r.longitude),
        max_participants: num(r.max_participants) ?? 8,
        cost_basis: clean(r.cost_basis),
        is_published: bool(r.is_published) ? 1 : 0,
      },
    };
  });
  if (imageSkips)
    console.log(
      `  ℹ ${imageSkips} event(s) referenced an image file (not migrated)`,
    );

  importCollection('testimonials', 'testimonials.csv', 'testimonials', (r) => {
    if (isDeleted(r)) return null;
    return {
      id: id('t', r.id),
      data: {
        quote: clean(r.quote).slice(0, 1000),
        author_name: clean(r.author_name),
        role: clean(r.role),
        email: (r.email || '').trim().toLowerCase(),
        is_published: bool(r.is_published) ? 1 : 0,
        published_at: date(r.published_at),
        sort_order: num(r.sort_order) ?? 0,
      },
    };
  });

  importCollection('newsletters', 'newsletters.csv', 'newsletters', (r) => {
    const status = ['draft', 'sending', 'sent'].includes(r.status)
      ? r.status
      : r.sent_at
        ? 'sent'
        : 'draft';
    return {
      id: id('m', r.id),
      data: {
        subject: r.subject || '(ohne Betreff)',
        content: r.content || '<p></p>',
        status,
        sent_at: date(r.sent_at),
        recipient_count: num(r.recipient_count) ?? 0,
      },
    };
  });

  importCollection(
    'registrations',
    'registrations.csv',
    'registrations',
    (r) => {
      if (isDeleted(r)) return null;
      const participantId = id('p', r.participant_id);
      const eventId = id('e', r.event_id);
      if (
        !importedParticipants.has(participantId) ||
        !importedEvents.has(eventId)
      ) {
        return null; // dangling relation (e.g. event was deleted) — skip
      }
      const status = [
        'registered',
        'waitlist',
        'cancelled',
        'attended',
      ].includes(r.status)
        ? r.status
        : 'registered';
      return {
        id: id('r', r.id),
        data: {
          participant_id: participantId,
          event_id: eventId,
          status,
          registered_at: date(r.registered_at) || date(r.created_at),
          cancelled_at: date(r.cancelled_at),
          reminder_sent_at: date(r.reminder_sent_at),
          sms_reminder_sent_at: date(r.sms_reminder_sent_at),
        },
      };
    },
  );

  importCollection(
    'newsletter_subscribers',
    'newsletter_subscriptions.csv',
    'newsletter_subscribers',
    (r) => {
      if (isDeleted(r)) return null;
      const participantId = id('p', r.participant_id);
      if (!importedParticipants.has(participantId)) return null;
      return {
        id: id('n', r.id),
        data: {
          participant_id: participantId,
          token: r.token || crypto.randomUUID().replace(/-/g, ''),
          subscribed_at: date(r.subscribed_at),
          confirmed_at: date(r.confirmed_at),
          unsubscribed_at: date(r.unsubscribed_at),
        },
      };
    },
  );

  console.log('\nDone.');
}

main();
