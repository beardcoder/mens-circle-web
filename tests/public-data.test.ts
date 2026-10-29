import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'bun:test';

test('public data: visibility, ETags and failures', () => {
  const sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'mens-circle-public-test-')));

  try {
    const result = spawnSync(
      process.execPath,
      ['--no-env-file', fileURLToPath(new URL('./public-data.fixture.ts', import.meta.url))],
      {
        cwd: sandbox,
        env: {
          PATH: process.env.PATH,
          TMPDIR: tmpdir(),
          NODE_ENV: 'test',
          DATABASE_PATH: join(sandbox, 'disposable.sqlite'),
          MIGRATIONS_DIR: fileURLToPath(new URL('../drizzle', import.meta.url)),
        },
        encoding: 'utf8',
        timeout: 15_000,
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}, 20_000);
