/**
 * iCalendar (.ics) builder — VCALENDAR with TZID Europe/Berlin. Ported from the
 * former `pb_hooks/lib/ics.js`; the wall-clock time stored on the event is
 * emitted verbatim with the Berlin VTIMEZONE so calendars resolve DST correctly.
 */
import type { EventRow } from './db/schema';
import { fullAddress, toDate } from './format';

function icsEscape(text: unknown): string {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

const p = (n: number) => String(n).padStart(2, '0');

/** Floating local datetime "YYYYMMDDTHHMMSS" (used together with TZID). */
function icsLocal(d: Date): string {
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

function icsUtc(d: Date): string {
  return `${icsLocal(d)}Z`;
}

/** Combine the event date + "HH:MM" string into a Berlin wall-clock Date. */
function combineDateTime(
  eventDate: unknown,
  timeStr?: string | null,
): Date | null {
  const base = toDate(eventDate);
  if (!base) return null;
  let h = base.getUTCHours();
  let m = base.getUTCMinutes();
  if (timeStr && /^\d{1,2}:\d{2}/.test(timeStr)) {
    const parts = timeStr.split(':');
    h = Number.parseInt(parts[0], 10);
    m = Number.parseInt(parts[1], 10);
  }
  return new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate(),
      h,
      m,
      0,
    ),
  );
}

export function buildIcs(ev: EventRow): string {
  const start = combineDateTime(ev.eventDate, ev.startTime);
  const end =
    combineDateTime(ev.eventDate, ev.endTime) ||
    (start ? new Date(start.getTime() + 90 * 60 * 1000) : null);
  if (!start || !end) return '';

  const uid = `${ev.id}@mens-circle.de`;
  const summary = icsEscape(ev.title);
  const location = icsEscape(
    [ev.location, fullAddress(ev)].filter(Boolean).join(', '),
  );
  const description = icsEscape(ev.description);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Maennerkreis Niederbayern Straubing//mens-circle-web//DE',
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
    `DTSTAMP:${icsUtc(new Date())}`,
    `DTSTART;TZID=Europe/Berlin:${icsLocal(start)}`,
    `DTEND;TZID=Europe/Berlin:${icsLocal(end)}`,
    `SUMMARY:${summary}`,
  ];
  if (location) lines.push(`LOCATION:${location}`);
  if (description) lines.push(`DESCRIPTION:${description}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n');
}
