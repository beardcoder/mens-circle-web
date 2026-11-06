/**
 * When a reminder may go out, in Berlin wall-clock time: the evening before the
 * event (18:00–22:00, "morgen") or, for whoever was not reached then, the morning of
 * the day itself from 10:00 until the start ("heute"). Outside both windows nothing
 * is sent, so nobody gets a mail at night. One reminder per registration: the
 * caller stamps `reminder_sent_at` and never sends again.
 */
import { addDays, berlinClock, eventDay, parseClockTime } from '../shared/time';

export const EVENING_FROM = 18 * 60;
export const EVENING_UNTIL = 22 * 60;
export const MORNING_FROM = 10 * 60;

export type ReminderKind = 'tomorrow' | 'today';

/** Which reminder an event on `eventDate` is due for at `now`, if any. */
export const reminderDue = (eventDate: string, startTime: string, now: Date): ReminderKind | null => {
  const day = eventDay(eventDate);

  if (!day) return null;

  const clock = berlinClock(now);

  if (clock.day === addDays(day, -1)) {
    return clock.minutes >= EVENING_FROM && clock.minutes < EVENING_UNTIL ? 'tomorrow' : null;
  }

  if (clock.day === day) {
    const start = parseClockTime(startTime) ?? 24 * 60;

    return clock.minutes >= MORNING_FROM && clock.minutes < start ? 'today' : null;
  }

  return null;
};

/** The calendar days whose events may be due at `now`: today and tomorrow in Berlin. */
export const candidateDays = (now: Date): { from: string; to: string } => {
  const today = berlinClock(now).day;

  return { from: today, to: addDays(today, 2) };
};
