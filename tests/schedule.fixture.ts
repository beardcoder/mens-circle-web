/* eslint-disable no-console */
import { mock, setSystemTime } from 'bun:test';

setSystemTime(new Date(process.env.SCHEDULE_AT!));

mock.module('../src/lib/server/reminders', () => ({
  runReminders: async () => {
    console.log('TASK reminders');

    if (process.env.REMINDER_FAILS === '1') throw new Error('reminder unavailable');
  },
}));

mock.module('../scripts/backup-db', () => ({
  backupConfigured: () => process.env.BACKUP_ENABLED === '1',
  runBackup: async () => {
    console.log('TASK backup');
  },
}));
