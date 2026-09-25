/** Regression guard for the 403 that broke every Anmeldung in production: "Cross-site POST form submissions are forbidden". */
import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./forwarded-origin.fixture.ts', import.meta.url));
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** `PUBLIC_SITE_URL` per scenario; `undefined` leaves it unset entirely. */
const scenarios: Array<[string, string | undefined]> = [
  ['default', undefined],
  ['custom-domain', 'https://kreis.example.org'],
  ['local-http', 'http://localhost:4321'],
];

for (const [scenario, siteUrl] of scenarios) {
  test(`forwarded origin: ${scenario}`, () => {
    const result = spawnSync(process.execPath, ['--no-env-file', fixture, scenario], {
      cwd: repoRoot,
      env: {
        PATH: process.env.PATH,
        TMPDIR: tmpdir(),
        NODE_ENV: 'test',
        ...(siteUrl ? { PUBLIC_SITE_URL: siteUrl } : {}),
      },
      encoding: 'utf8',
      timeout: 15_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  }, 20_000);
}
