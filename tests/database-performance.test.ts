import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./database-performance.fixture.ts', import.meta.url));
const migrations = fileURLToPath(new URL('../drizzle', import.meta.url));

// Each scenario has its own process, module cache and on-disk database. No
// mock.module, env changes or DB imports can leak into another test file.
for (const scenario of ['events', 'states', 'testimonials', 'migration']) {
  test(`database performance: ${scenario}`, () => {
    const sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'mens-circle-db-test-')));
    try {
      const result = spawnSync(process.execPath, ['--no-env-file', fixture, scenario], {
        cwd: sandbox,
        env: {
          PATH: process.env.PATH,
          TMPDIR: tmpdir(),
          NODE_ENV: 'test',
          DATABASE_PATH: join(sandbox, 'disposable.sqlite'),
          MIGRATIONS_DIR: migrations,
        },
        encoding: 'utf8',
        timeout: 15_000,
      });
      expect(result.error).toBeUndefined();
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  }, 20_000);
}
