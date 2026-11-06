/**
 * Wall-clock time in Europe/Berlin, where every event takes place. Pure functions
 * without Node or Bun imports, so pages, client code and server code share them.
 */
export const TIME_ZONE = 'Europe/Berlin';

const DAY_MS = 86_400_000;

export interface BerlinClock {
  /** The calendar day, "2026-11-06". */
  day: string;
  /** Minutes since local midnight. */
  minutes: number;
}

const clockFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** The day and time a clock on the wall in Berlin shows at `now`. */
export const berlinClock = (now: Date = new Date()): BerlinClock => {
  const parts = Object.fromEntries(clockFormat.formatToParts(now).map((p) => [p.type, p.value]));

  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

/** Today in Berlin, "2026-11-06". */
export const todayBerlin = (now: Date = new Date()): string => berlinClock(now).day;

/** "2026-11-06" plus `n` calendar days. */
export const addDays = (day: string, n: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** "19:30" as minutes since midnight, or null for anything else. */
export const parseClockTime = (value: string | null | undefined): number | null => {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? '');

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
};

/** The calendar day of a stored event date ("2026-11-12" or "2026-11-12T00:00:00.000Z"). */
export const eventDay = (value: string | null | undefined): string => {
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value ?? '');

  return match ? match[0] : '';
};
