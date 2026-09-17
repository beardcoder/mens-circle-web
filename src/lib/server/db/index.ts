/**
 * Opens the SQLite file from `DATABASE_PATH` and applies the migrations under
 * `./drizzle` on first import. The Bun server is long-lived, so this runs once
 * per process and a fresh deploy provisions its schema with no manual step.
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
// The data volume may be empty on a fresh deploy.
if (dbPath !== ':memory:') {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(dbPath, { create: true });
// Tuned for a long-lived, low-RAM single-writer server:
//   • WAL                 readers never block the writer.
//   • synchronous=NORMAL  drops a full fsync per transaction, still durable
//                         across an app crash; only power loss costs the last commit.
//   • foreign_keys        enforce the registration↔event/participant relations.
//   • busy_timeout        wait out a brief writer lock instead of erroring.
sqlite.run('PRAGMA journal_mode = WAL;');
sqlite.run('PRAGMA synchronous = NORMAL;');
sqlite.run('PRAGMA foreign_keys = ON;');
sqlite.run('PRAGMA busy_timeout = 5000;');

export const db = drizzle(sqlite, { schema });

// Resolved against cwd so it works in local dev and in the container.
const migrationsFolder = resolve(process.cwd(), process.env.MIGRATIONS_DIR || './drizzle');
try {
  migrate(db, { migrationsFolder });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[db] migration failed', err);
  throw err;
}

export { schema };
