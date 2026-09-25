import { expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// The Pocket ID sign-in, against a fake provider. Each case is its own Bun
// process: config is read at module load, and the discovery cache is module state.
const cases = [
  'happy-path',
  'group-admission',
  'unlisted-email',
  'unverified-email',
  'state-mismatch',
  'tampered-flow-cookie',
  'provider-down',
  'safe-redirect',
  'unconfigured',
];

for (const scenario of cases) {
  test(`admin sign-in (isolated): ${scenario}`, async () => {
    const child = Bun.spawn(
      [process.execPath, '--no-env-file', fileURLToPath(new URL('./admin-oidc.fixture.ts', import.meta.url)), scenario],
      {
        env: {
          PATH: process.env.PATH,
          TMPDIR: tmpdir(),
          NODE_ENV: 'test',
          OIDC_TEST: '1',
          APP_URL: 'https://app.example.invalid/',
          OIDC_ISSUER: 'https://id.example.invalid/',
          OIDC_CLIENT_ID: 'client-id',
          OIDC_CLIENT_SECRET: 'client-secret',
          ADMIN_EMAIL: 'Admin@Example.invalid, second@example.invalid',
          ...(scenario === 'group-admission' ? { OIDC_ADMIN_GROUP: 'mens-circle-admins' } : {}),
          ADMIN_SESSION_SECRET: scenario === 'unconfigured' ? 'short' : 'x'.repeat(48),
        },
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 10_000,
      },
    );
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect({ code, output: code === 0 ? '' : stdout + stderr }).toEqual({ code: 0, output: '' });
    expect(stdout).toContain(`PASS ${scenario}`);
  }, 15_000);
}
