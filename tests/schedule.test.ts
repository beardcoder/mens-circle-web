import { fileURLToPath } from 'node:url';
import { expect, test } from 'bun:test';

const fixture = fileURLToPath(new URL('./schedule.fixture.ts', import.meta.url));

function schedule(at: string, backup = true, reminderFails = false) {
  const result = Bun.spawnSync([process.execPath, '--no-env-file', '--preload', fixture, './scripts/schedule.ts'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: {
      PATH: process.env.PATH,
      SCHEDULE_AT: at,
      BACKUP_ENABLED: backup ? '1' : '0',
      REMINDER_FAILS: reminderFails ? '1' : '0',
      TZ: 'Europe/Berlin',
    },
  });

  return { code: result.exitCode, output: result.stdout.toString(), error: result.stderr.toString() };
}

test('reminders run only on quarter hours, including across UTC date boundaries', () => {
  for (const time of ['00:00', '12:15', '23:30', '23:45']) {
    const result = schedule(`2026-10-19T${time}:00Z`);

    expect(result.code).toBe(0);
    expect(result.output).toContain('TASK reminders');
    expect(result.output).not.toContain('TASK backup');
  }

  expect(schedule('2026-10-19T03:01:00Z').output).toBe('');
  expect(schedule('2026-10-19T23:59:00Z').output).toBe('');
});

test('backup runs at 03:00 UTC only when configured', () => {
  expect(schedule('2026-10-19T03:00:00Z').output).toContain('TASK backup');
  expect(schedule('2026-10-19T03:00:00Z', false).output).not.toContain('TASK backup');
  expect(schedule('2026-10-19T02:00:00Z').output).not.toContain('TASK backup');
});

test('a failed reminder reports failure while still running the due backup', () => {
  const result = schedule('2026-10-19T03:00:00Z', true, true);

  expect(result.code).toBe(1);
  expect(result.error).toContain('[schedule] reminders failed');
  expect(result.output).toContain('TASK backup');
});
