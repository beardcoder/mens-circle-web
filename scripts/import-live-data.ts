/**
 * Import live data (Laravel CSV exports) into the new PocketBase structure.
 *
 * Usage:
 *   PB_URL=http://localhost:8090 \
 *   PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=secret \
 *   bun run scripts/import-live-data.ts <csv-dir>
 *
 * Idempotent: records get deterministic 15-char IDs derived from their old
 * integer IDs, so re-running updates in place instead of duplicating. Relations
 * (registrations → participant/event) are resolved through the same derivation.
 *
 * Note: newsletters + subscribers are NOT imported here — they live in listmonk
 * now. Import the historical newsletter CSVs into listmonk directly instead.
 *
 * Maps the dynamic collections only. Static content (pages, content_blocks,
 * navigation_items, settings) already lives in the Astro JSON files.
 */
import { readFileSync } from 'node:fs';

const PB_URL = (process.env.PB_URL || 'http://localhost:8090').replace(
  /\/$/,
  '',
);
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;
const CSV_DIR = process.argv[2];

if (!CSV_DIR) {
  console.error('Usage: bun run scripts/import-live-data.ts <csv-dir>');
  process.exit(1);
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD.');
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
      .padStart(15 - prefix.length, '0')
  ).slice(0, 15);
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

// ── PocketBase REST helpers ─────────────────────────────────────────────────
let token = '';

async function auth(): Promise<void> {
  const res = await fetch(
    `${PB_URL}/api/collections/_superusers/auth-with-password`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    },
  );
  if (!res.ok)
    throw new Error(`Auth failed (${res.status}): ${await res.text()}`);
  token = ((await res.json()) as { token: string }).token;
}

async function upsert(
  collection: string,
  recordId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  const headers = { 'Content-Type': 'application/json', Authorization: token };
  const existing = await fetch(
    `${PB_URL}/api/collections/${collection}/records/${recordId}`,
    { headers },
  );
  const body = JSON.stringify({ id: recordId, ...data });
  const res =
    existing.status === 200
      ? await fetch(
          `${PB_URL}/api/collections/${collection}/records/${recordId}`,
          {
            method: 'PATCH',
            headers,
            body,
          },
        )
      : await fetch(`${PB_URL}/api/collections/${collection}/records`, {
          method: 'POST',
          headers,
          body,
        });
  if (!res.ok) {
    console.warn(
      `  ⚠ ${collection}/${recordId}: ${res.status} ${await res.text()}`,
    );
    return false;
  }
  return true;
}

// ── Importers (dependency order) ────────────────────────────────────────────
const importedParticipants = new Set<string>();
const importedEvents = new Set<string>();

async function importCollection(
  label: string,
  file: string,
  collection: string,
  map: (r: Row) => Mapped | null,
): Promise<void> {
  const rows = readCsv(file);
  let ok = 0;
  let skipped = 0;
  for (const r of rows) {
    const mapped = map(r);
    if (!mapped) {
      skipped++;
      continue;
    }
    if (await upsert(collection, mapped.id, mapped.data)) ok++;
    else skipped++;
  }
  console.log(
    `✓ ${label}: ${ok} imported, ${skipped} skipped (of ${rows.length})`,
  );
}

async function main(): Promise<void> {
  console.log(`Importing into ${PB_URL} from ${CSV_DIR}\n`);
  await auth();

  await importCollection(
    'participants',
    'participants.csv',
    'participants',
    (r) => {
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
    },
  );

  let imageSkips = 0;
  await importCollection('events', 'events.csv', 'events', (r) => {
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
        is_published: bool(r.is_published),
        // image (file) is not migrated — binaries aren't in the CSV export.
      },
    };
  });
  if (imageSkips)
    console.log(
      `  ℹ ${imageSkips} event(s) referenced an image file (not migrated)`,
    );

  await importCollection(
    'testimonials',
    'testimonials.csv',
    'testimonials',
    (r) => {
      if (isDeleted(r)) return null;
      return {
        id: id('t', r.id),
        data: {
          quote: clean(r.quote).slice(0, 1000),
          author_name: clean(r.author_name),
          role: clean(r.role),
          email: (r.email || '').trim().toLowerCase(),
          is_published: bool(r.is_published),
          published_at: date(r.published_at),
          sort_order: num(r.sort_order) ?? 0,
        },
      };
    },
  );

  await importCollection(
    'registrations',
    'registrations.csv',
    'registrations',
    (r) => {
      if (isDeleted(r)) return null;
      const participant = id('p', r.participant_id);
      const event = id('e', r.event_id);
      if (
        !importedParticipants.has(participant) ||
        !importedEvents.has(event)
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
          participant,
          event,
          status,
          registered_at: date(r.registered_at) || date(r.created_at),
          cancelled_at: date(r.cancelled_at),
          reminder_sent_at: date(r.reminder_sent_at),
          sms_reminder_sent_at: date(r.sms_reminder_sent_at),
        },
      };
    },
  );

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
