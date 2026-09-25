/** Regression guard: ADMIN_SESSION_SECRET must never fall back to ADMIN_PASSWORD or to a literal default. */
import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./admin-session-secret.fixture.ts', import.meta.url));
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const baseEnv = { PATH: process.env.PATH, TMPDIR: tmpdir(), NODE_ENV: 'test' };

const scenarios: Array<[string, Record<string, string>]> = [
  ['unset', {}],
  ['password-only', { ADMIN_EMAIL: 'admin@example.invalid', ADMIN_PASSWORD: 'correct-horse-battery-staple' }],
  ['short', { ADMIN_SESSION_SECRET: 'short-secret' }],
  ['configured', { ADMIN_SESSION_SECRET: 'a-long-random-session-secret-for-the-test-suite' }],
];

for (const [scenario, env] of scenarios) {
  test(`admin session secret: ${scenario}`, () => {
    const result = spawnSync(process.execPath, ['--no-env-file', fixture, scenario], {
      cwd: repoRoot,
      env: { ...baseEnv, ...env },
      encoding: 'utf8',
      timeout: 15_000,
    });
    expect(result.error).toBeUndefined();
    expect({ code: result.status, output: result.status === 0 ? '' : result.stdout + result.stderr }).toEqual({
      code: 0,
      output: '',
    });
    expect(result.stdout).toContain(`PASS ${scenario}`);
  }, 20_000);
}
