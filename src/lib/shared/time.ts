/**
 * The one time model. Events happen in Europe/Berlin: `event_date` is a calendar day
 * ("2026-11-12"), `start_time` and `end_time` are wall-clock times ("19:00"). Every
 * label, comparison and timestamp derives from these helpers; nothing reads `getUTC*`
 * of an event date. Pure functions without Node or Bun imports, for pages, client
 * code, mails and scripts alike.
 */
const TIME_ZONE = 'Europe/Berlin';

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

/** The calendar day of a stored event date ("2026-11-12"; older rows "2026-11-12T00:00:00.000Z"). */
export const eventDay = (value: string | null | undefined): string => {
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value ?? '');

  return match ? match[0] : '';
};

/** The day at noon UTC: a Date whose UTC fields are the calendar day, safe to format in UTC. */
const noon = (day: string): Date | null => {
  const d = eventDay(day);

  return d ? new Date(`${d}T12:00:00Z`) : null;
};

const formatDay = (day: string, options: Intl.DateTimeFormatOptions): string => {
  const date = noon(day);

  return date ? new Intl.DateTimeFormat('de-DE', { ...options, timeZone: 'UTC' }).format(date) : '';
};

/** "Donnerstag, 18. September 2026". */
export const formatDateLong = (day: string): string =>
  formatDay(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** "18. September 2026". */
export const formatDayMonthYear = (day: string): string =>
  formatDay(day, { day: 'numeric', month: 'long', year: 'numeric' });

/** "18.09.2026". */
export const formatDateShort = (day: string): string =>
  formatDay(day, { day: '2-digit', month: '2-digit', year: 'numeric' });

/** The date's seal: "18" and "Sept.". */
export const daySeal = (day: string): { day: string; month: string } => ({
  day: formatDay(day, { day: '2-digit' }),
  month: formatDay(day, { month: 'short' }),
});

/** "19:00–21:30 Uhr", "19:00 Uhr", or '' without a start: the one spelling, on pages and in mails. */
export const formatTimeRange = (start: string, end: string): string =>
  start ? `${start}${end ? `–${end}` : ''} Uhr` : '';

const offsetFormat = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, timeZoneName: 'longOffset' });

/** Berlin's UTC offset in minutes at an instant (60 in winter, 120 in summer). */
const offsetAt = (instant: number): number => {
  const name = offsetFormat.formatToParts(new Date(instant)).find((p) => p.type === 'timeZoneName')?.value ?? '';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);

  return match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
};

const formatOffset = (minutes: number): string =>
  `${minutes < 0 ? '-' : '+'}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0')}:${String(Math.abs(minutes) % 60).padStart(2, '0')}`;

export interface ZonedTime {
  /** The instant. */
  date: Date;
  /** "2026-09-18T19:00:00+02:00", for structured data. */
  iso: string;
  /** "20260918T190000", Berlin wall clock for calendar files. */
  wall: string;
}

/** A Berlin wall-clock time on a calendar day, as an instant; null without a valid day or time. */
export const zonedTime = (day: string, time: string): ZonedTime | null => {
  const d = eventDay(day);
  const minutes = parseClockTime(time);

  if (!d || minutes === null) return null;

  const wallAsUtc = Date.parse(`${d}T00:00:00Z`) + minutes * 60_000;
  // Two passes: the offset at the guessed instant settles the day the clocks change.
  const offset = offsetAt(wallAsUtc - offsetAt(wallAsUtc) * 60_000);
  const date = new Date(wallAsUtc - offset * 60_000);

  return {
    date,
    iso: `${d}T${time}:00${formatOffset(offset)}`,
    wall: `${d.replace(/-/g, '')}T${time.replace(':', '')}00`,
  };
};

/** An event's start; without a start time, its day's midnight in Berlin. */
export const eventStart = (ev: { eventDate: string; startTime: string }): Date | null =>
  (zonedTime(ev.eventDate, ev.startTime) ?? zonedTime(ev.eventDate, '00:00'))?.date ?? null;

/** Past once its calendar day is over in Berlin. */
export const isPast = (eventDate: string, now: Date = new Date()): boolean => {
  const day = eventDay(eventDate);

  return !!day && day < todayBerlin(now);
};
