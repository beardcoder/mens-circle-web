/**
 * Regression guard for the 403 that broke every Anmeldung in production:
 * "Cross-site POST form submissions are forbidden".
 *
 * TLS terminates at the Coolify/Traefik proxy, so the Bun process sees plain
 * HTTP and builds `http://<host>` as the request URL, while the browser's
 * `Origin` on the form POST says `https://<host>`. Astro's CSRF check compares
 * the two and rejects the mismatch. `security.allowedDomains` in
 * astro.config.mjs is what makes Astro trust `X-Forwarded-Proto` and repair the
 * URL first — so this exercises Astro's own validator and origin check against
 * the real config, not a copy of it.
 *
 * Each scenario runs in its own Bun process, started with `--no-env-file` and
 * an explicit environment, like the database and email suites. The config reads
 * `PUBLIC_SITE_URL` at module load, so an in-process version of this test
 * measured the developer's `.env` rather than the shipped config: copying
 * `.env.example` and pointing it at localhost to run the site — which CLAUDE.md
 * asks you to do — turned the suite red while nothing was actually wrong.
 */
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
