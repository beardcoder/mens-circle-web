/**
 * Database singleton — `bun:sqlite` wrapped by Drizzle.
 *
 * The schema is created idempotently on first access (`CREATE TABLE IF NOT
 * EXISTS`), so a fresh deploy is usable with no migration step and no second
 * process — this is the boot-time "migrations" that PocketBase used to run.
 * `drizzle.config.ts` + `drizzle-kit studio` stay available for dev browsing.
 *
 * Swapping the host means swapping only this file (e.g. `drizzle-orm/d1` with a
 * Cloudflare D1 binding); the schema and every service above it stay untouched.
 */

import type { Database as BunDatabase } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import type {
  BunSQLiteDatabase,
  drizzle as drizzleFn,
} from 'drizzle-orm/bun-sqlite';
import { config } from '../config';
import * as schema from './schema';

// `bun:sqlite` (and drizzle's bun-sqlite driver, which imports it statically)
// are Bun-only. Load them lazily at runtime rather than as static imports: the
// Astro CLI prerenders pages under *Node* at build time, where a top-level
// `import 'bun:sqlite'` would crash. `getDb()` only runs on-demand in the Bun
// server, so these requires never execute during the build.
const requireRuntime = createRequire(import.meta.url);
function loadDatabase(): typeof BunDatabase {
  return (requireRuntime('bun:sqlite') as { Database: typeof BunDatabase })
    .Database;
}
function loadDrizzle(): typeof drizzleFn {
  return (
    requireRuntime('drizzle-orm/bun-sqlite') as { drizzle: typeof drizzleFn }
  ).drizzle;
}

const DDL = `
CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  created INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_email ON participants (email);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  event_date INTEGER NOT NULL,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  location_details TEXT,
  street TEXT,
  postal_code TEXT,
  city TEXT,
  latitude REAL,
  longitude REAL,
  max_participants INTEGER NOT NULL DEFAULT 8,
  cost_basis TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  deleted INTEGER,
  listmonk_list_id INTEGER,
  created INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_slug ON events (slug);

CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY NOT NULL,
  participant TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  event TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered',
  registered_at INTEGER,
  cancelled_at INTEGER,
  reminder_sent_at INTEGER,
  sms_reminder_sent_at INTEGER,
  deleted INTEGER,
  created INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_participant_event ON registrations (participant, event);
CREATE INDEX IF NOT EXISTS idx_registrations_event_status ON registrations (event, status);

CREATE TABLE IF NOT EXISTS testimonials (
  id TEXT PRIMARY KEY NOT NULL,
  quote TEXT NOT NULL,
  author_name TEXT,
  email TEXT,
  role TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  published_at INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER,
  created INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
`;

export type DB = BunSQLiteDatabase<typeof schema>;

let _db: DB | null = null;

export function getDb(): DB {
  if (_db) return _db;

  const dir = dirname(config.DB_PATH);
  if (dir && dir !== '.' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const Database = loadDatabase();
  const sqlite = new Database(config.DB_PATH, { create: true });
  sqlite.run('PRAGMA journal_mode = WAL;');
  sqlite.run('PRAGMA foreign_keys = ON;');
  sqlite.run('PRAGMA busy_timeout = 5000;');
  // exec (not run) — the DDL contains multiple statements.
  sqlite.exec(DDL);

  _db = loadDrizzle()(sqlite, { schema });
  return _db;
}

export { schema };
