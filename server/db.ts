/**
 * EmDash — Embedded SQLite database layer using bun:sqlite.
 *
 * Replaces PocketBase with a zero-dependency embedded database that runs
 * in-process with the Bun server. Schema migrations are applied automatically
 * on first connection (idempotent). The database file lives at the path given
 * by the `DATABASE_PATH` env var (default: `./data/emdash.db`).
 */
import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

let _db: Database | null = null;

export function getDb(): Database {
  if (_db) return _db;

  const dbPath = process.env.DATABASE_PATH || './data/emdash.db';
  mkdirSync(dirname(dbPath), { recursive: true });

  _db = new Database(dbPath, { create: true });
  _db.exec('PRAGMA journal_mode = WAL');
  _db.exec('PRAGMA foreign_keys = ON');
  _db.exec('PRAGMA busy_timeout = 5000');

  runMigrations(_db);
  return _db;
}

function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  for (const m of migrations) {
    const exists = db
      .query('SELECT 1 FROM _migrations WHERE name = ?')
      .get(m.name);
    if (!exists) {
      db.exec(m.sql);
      db.query('INSERT INTO _migrations (name) VALUES (?)').run(m.name);
    }
  }
}

// ── Schema Migrations ─────────────────────────────────────────────────────────

const migrations: { name: string; sql: string }[] = [
  {
    name: '001_participants',
    sql: `
      CREATE TABLE participants (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
        first_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX idx_participants_email ON participants(email);
    `,
  },
  {
    name: '002_events',
    sql: `
      CREATE TABLE events (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        event_date TEXT NOT NULL,
        start_time TEXT NOT NULL DEFAULT '',
        end_time TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        location_details TEXT NOT NULL DEFAULT '',
        street TEXT NOT NULL DEFAULT '',
        postal_code TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '',
        latitude REAL,
        longitude REAL,
        max_participants INTEGER NOT NULL DEFAULT 8,
        cost_basis TEXT NOT NULL DEFAULT '',
        image_url TEXT,
        is_published INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX idx_events_slug ON events(slug);
    `,
  },
  {
    name: '003_registrations',
    sql: `
      CREATE TABLE registrations (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
        participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK(status IN ('registered','waitlist','cancelled','attended')),
        registered_at TEXT,
        cancelled_at TEXT,
        reminder_sent_at TEXT,
        sms_reminder_sent_at TEXT,
        deleted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX idx_registrations_participant_event ON registrations(participant_id, event_id);
    `,
  },
  {
    name: '004_newsletter_subscribers',
    sql: `
      CREATE TABLE newsletter_subscribers (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
        participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        subscribed_at TEXT,
        confirmed_at TEXT,
        unsubscribed_at TEXT,
        deleted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX idx_newsletter_subscribers_participant ON newsletter_subscribers(participant_id);
      CREATE UNIQUE INDEX idx_newsletter_subscribers_token ON newsletter_subscribers(token);
    `,
  },
  {
    name: '005_newsletters',
    sql: `
      CREATE TABLE newsletters (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
        subject TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sending','sent')),
        sent_at TEXT,
        recipient_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    name: '006_testimonials',
    sql: `
      CREATE TABLE testimonials (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
        quote TEXT NOT NULL,
        author_name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT '',
        is_published INTEGER NOT NULL DEFAULT 0,
        published_at TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

// ── Query helpers ─────────────────────────────────────────────────────────────

export function generateId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function nowISO(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}
