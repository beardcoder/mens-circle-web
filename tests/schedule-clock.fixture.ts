import { setSystemTime } from 'bun:test';

setSystemTime(new Date(process.env.SCHEDULE_AT!));
