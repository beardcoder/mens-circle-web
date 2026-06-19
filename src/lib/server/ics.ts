/**
 * iCalendar (.ics) builder — VCALENDAR with TZID Europe/Berlin. Ported from the
 * former PocketBase `pb_hooks/lib/ics.js`. Server-only.
 */
import type { Event } from './db/schema';
import { fullAddress, toDate } from './format';

function icsEscape(text: unknown): string {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

const pad = (n: number) => String(n).padStart(2, '0');

function icsLocal(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

function icsUtc(d: Date): string {
  return `${icsLocal(d)}Z`;
}

/** Combine event_date + "HH:MM" into a Date in Europe/Berlin wall time. */
function combineDateTime(eventDateValue: unknown, timeStr: string): Date | null {
  const base = toDate(eventDateValue);
  if (!base) return null;
  let h = base.getUTCHours();
  let m = base.getUTCMinutes();
  if (timeStr && /^\d{1,2}:\d{2}/.test(timeStr)) {
    const parts = timeStr.split(':');
    h = Number.parseInt(parts[0], 10);
    m = Number.parseInt(parts[1], 10);
  }
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h, m, 0));
}

/** Build an ICS string for an event (empty string if it has no valid date). */
export function buildIcs(ev: Event): string {
  const start = combineDateTime(ev.eventDate, ev.startTime);
  const end = combineDateTime(ev.eventDate, ev.endTime) || (start ? new Date(start.getTime() + 90 * 60 * 1000) : null);
  if (!start || !end) return '';

  const uid = `${ev.id}@mens-circle.de`;
  const now = new Date();
  const summary = icsEscape(ev.title);
  const location = icsEscape([ev.location, fullAddress(ev)].filter(Boolean).join(', '));
  const description = icsEscape(ev.description);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Maennerkreis Niederbayern Straubing//Web//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Berlin',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsUtc(now)}`,
    `DTSTART;TZID=Europe/Berlin:${icsLocal(start)}`,
    `DTEND;TZID=Europe/Berlin:${icsLocal(end)}`,
    `SUMMARY:${summary}`,
  ];
  if (location) lines.push(`LOCATION:${location}`);
  if (description) lines.push(`DESCRIPTION:${description}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n');
}
