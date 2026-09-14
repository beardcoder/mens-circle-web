import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// No server imports or global/module mocks in the suite process. Each case owns its HTTP fake and DB.
const cases = [
  'provisioning-dedupe',
  'provisioning-conflict',
  'provisioning-errors',
  'workflow-reuse',
  'membership-failure',
  'consent-and-status',
  'reminder-acceptance',
  'reminder-disabled',
  'reminder-stamp-failure',
  'broadcast',
  'registration-async',
];

for (const scenario of cases) {
  test(`email backend (isolated): ${scenario}`, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mens-circle-email-'));
    try {
      const child = Bun.spawn(
        [process.execPath, 'run', fileURLToPath(new URL('./email-backend.fixture.ts', import.meta.url)), scenario],
        {
          cwd: fileURLToPath(new URL('../', import.meta.url)),
          env: {
            ...process.env,
            EMAIL_TEST_DIR: dir,
            DATABASE_PATH: join(dir, 'test.sqlite'),
            MIGRATIONS_DIR: fileURLToPath(new URL('../drizzle', import.meta.url)),
            LISTMONK_URL: 'http://listmonk.invalid',
            LISTMONK_API_USER: 'test',
            LISTMONK_API_TOKEN: 'test',
            LISTMONK_LIST_IDS: '9',
            LISTMONK_TX_REGISTRATION_CONFIRMATION: '1',
            LISTMONK_TX_WAITLIST_CONFIRMATION: '2',
            LISTMONK_TX_ADMIN_NOTIFICATION: '3',
            LISTMONK_TX_EVENT_REMINDER: '4',
            LISTMONK_TX_EVENT_MESSAGE: '5',
            MAIL_ADMIN_ADDRESS: 'admin@example.invalid',
            APP_URL: 'http://app.invalid',
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
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 15_000);
}
