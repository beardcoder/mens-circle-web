/**
 * The SQLite database. `openDatabase(path)` opens a file (or `:memory:`) and applies the
 * migrations under `./drizzle`; nothing happens on import. The app uses one shared
 * handle, opened on first use from `DATABASE_PATH` (`getDb()`, or `db`, which forwards
 * to it). Tests open their own and install it with `useDatabase()`.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { Database } from 'bun:sqlite';

import { type BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

import { config } from '../config';
import * as schema from './schema';

export type Db = BunSQLiteDatabase<typeof schema> & { $client: Database };

const migrationsFolder = (): string => resolve(process.cwd(), process.env.MIGRATIONS_DIR || './drizzle');

export function openDatabase(path: string, opts: { migrationsFolder?: string } = {}): Db {
  const file = path === ':memory:' || isAbsolute(path) ? path : resolve(process.cwd(), path);

  // The data volume may be empty on a fresh deploy.
  if (file !== ':memory:') {
    const dir = dirname(file);

    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(file, { create: true });

  // WAL, NORMAL sync (durable across app crashes), FKs on, wait out brief write locks.
  sqlite.run('PRAGMA journal_mode = WAL;');
  sqlite.run('PRAGMA synchronous = NORMAL;');
  sqlite.run('PRAGMA foreign_keys = ON;');
  sqlite.run('PRAGMA busy_timeout = 5000;');

  const db = drizzle(sqlite, { schema }) as Db;

  try {
    migrate(db, { migrationsFolder: opts.migrationsFolder ?? migrationsFolder() });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[db] migration failed', err);
    sqlite.close();
    throw err;
  }

  // Refresh planner statistics on open; a no-op when current.
  sqlite.run('PRAGMA optimize = 0x10002;');

  return db;
}

let current: Db | null = null;

/** The app's database, opened from `DATABASE_PATH` on first use. */
export const getDb = (): Db => (current ??= openDatabase(config.DATABASE_PATH));

/** Replaces the shared handle (tests); returns it. */
export const useDatabase = (db: Db): Db => (current = db);

/** The shared handle under its old name; every access goes to `getDb()`. */
export const db: Db = new Proxy({} as Db, {
  get: (_, key) => {
    const target = getDb();
    const value = Reflect.get(target, key, target);

    return typeof value === 'function' ? value.bind(target) : value;
  },
});
