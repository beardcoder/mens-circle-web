/**
 * Database connection (bun:sqlite + Drizzle).
 *
 * Server-only. Opens the SQLite file from `DATABASE_PATH`, applies the
 * Drizzle migrations under `./drizzle` on first import, and exports a ready
 * `db` handle. Replaces PocketBase's embedded SQLite + JS migrations.
 *
 * Migrations run once at process start (the Bun server is long-lived), so a
 * fresh deploy provisions its schema with no manual step. The migrations
 * folder is shipped alongside the bundle (see Dockerfile).
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { config } from '../config';
import * as schema from './schema';

function resolveDbPath(): string {
  const p = config.DATABASE_PATH;
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

const dbPath = resolveDbPath();
// Ensure the parent directory exists (the data volume may be empty on a fresh
// deploy). Skip for the special in-memory database.
if (dbPath !== ':memory:') {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(dbPath, { create: true });
// Better concurrency + integrity for a long-lived server.
sqlite.run('PRAGMA journal_mode = WAL;');
sqlite.run('PRAGMA foreign_keys = ON;');
sqlite.run('PRAGMA busy_timeout = 5000;');

export const db = drizzle(sqlite, { schema });

// Apply migrations once. The folder is resolved against cwd so it works both in
// local dev (project root) and in the container (WORKDIR /app).
const migrationsFolder = resolve(process.cwd(), process.env.MIGRATIONS_DIR || './drizzle');
try {
  migrate(db, { migrationsFolder });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[db] migration failed', err);
  throw err;
}

export { schema };
