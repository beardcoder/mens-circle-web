/**
 * A disposable EmDash site for the checks that run the built server. The build names
 * the database relative to the working directory (`./data/emdash.db`), so a server
 * started in `dir` uses this sandbox's database and nothing else.
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';

export const root = new URL('..', import.meta.url).pathname;

/** One Portable Text paragraph. */
export const block = (text: string) => [
  {
    _type: 'block',
    _key: 'a',
    style: 'normal',
    markDefs: [],
    children: [{ _type: 'span', _key: 'b', text, marks: [] }],
  },
];

/** An evening from 19:00 to 21:30 Berlin time (winter). */
export const evening = (day: string) => ({ starts_at: `${day}T18:00:00.000Z`, ends_at: `${day}T20:30:00.000Z` });

export async function createSandbox(name: string) {
  const dir = await mkdtemp(join(tmpdir(), `mens-circle-${name}-`));
  const dbFile = join(dir, 'data', 'emdash.db');

  // The mail font route reads `src/assets/mail` from the working directory, as in the image.
  await symlink(join(root, 'src'), join(dir, 'src'));
  await mkdir(join(dir, 'data'), { recursive: true });

  /** Runs SQL against the sandbox database. */
  const sql = (statement: string): void => {
    const db = new Database(dbFile);

    db.exec(statement);
    db.close();
  };

  return {
    dir,
    dbFile,
    sql,

    /** Applies the site's seed plus `content` with EmDash's CLI. */
    async seed(content: Record<string, unknown[]> = {}): Promise<void> {
      const { collections } = JSON.parse(await readFile(join(root, 'seed/seed.json'), 'utf8'));
      const file = join(dir, 'seed.json');

      await writeFile(file, JSON.stringify({ version: '1', defaultLocale: 'de', collections, content }));
      const run = Bun.spawnSync([join(root, 'node_modules/.bin/emdash'), 'seed', file, '--database', dbFile], {
        stdout: 'ignore',
        stderr: 'pipe',
      });

      assert.equal(run.exitCode, 0, run.stderr.toString());
    },

    /** The stored id of an event, by slug. */
    eventId(slug: string): string {
      const db = new Database(dbFile);
      const row = db.query('select id from ec_events where slug = ?').get(slug) as { id: string };

      db.close();

      return row.id;
    },

    /** EmDash reads a missing table as empty, so a broken one is a view that fails on every read. */
    breakTable(table: string): void {
      sql(
        `ALTER TABLE ${table} RENAME TO ${table}_old; CREATE VIEW ${table} AS SELECT * FROM ${table}_old WHERE broken(id)`,
      );
    },

    remove: () => rm(dir, { recursive: true, force: true }),
  };
}
