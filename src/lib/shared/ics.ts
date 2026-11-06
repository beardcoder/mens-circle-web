import { zonedTime } from './time';

/** What a calendar entry needs; a DB `Event` fits as it is. */
export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
}

const icsEscape = (text: unknown): string =>
  String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');

const pad = (n: number) => String(n).padStart(2, '0');

/** An instant in UTC as "20260918T170000Z". */
const icsUtc = (d: Date): string =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
  `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** A Berlin wall-clock stamp ("20260918T190000") plus `minutes`, still wall-clock. */
const wallPlus = (wall: string, minutes: number): string => {
  const at = Date.UTC(
    +wall.slice(0, 4),
    +wall.slice(4, 6) - 1,
    +wall.slice(6, 8),
    +wall.slice(9, 11),
    +wall.slice(11, 13),
  );

  return icsUtc(new Date(at + minutes * 60_000)).slice(0, 15);
};

/** Start and end in Berlin wall-clock time; without an end, 90 minutes; without a start, no entry. */
const eventSpan = (ev: CalendarEvent): { start: string; end: string } | null => {
  const start = zonedTime(ev.eventDate, ev.startTime);

  if (!start) return null;

  const end = zonedTime(ev.eventDate, ev.endTime);

  return { start: start.wall, end: end && end.date > start.date ? end.wall : wallPlus(start.wall, 90) };
};

export const buildIcs = (ev: CalendarEvent): string => {
  const span = eventSpan(ev);

  if (!span) return '';

  return [
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
    `UID:${ev.id}@mens-circle.de`,
    `DTSTAMP:${icsUtc(new Date())}`,
    `DTSTART;TZID=Europe/Berlin:${span.start}`,
    `DTEND;TZID=Europe/Berlin:${span.end}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    ...(ev.location ? [`LOCATION:${icsEscape(ev.location)}`] : []),
    ...(ev.description ? [`DESCRIPTION:${icsEscape(ev.description)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
};

/** The same entry as a Google Calendar template link, or empty without a date. */
export const googleCalendarUrl = (ev: CalendarEvent): string => {
  const span = eventSpan(ev);

  if (!span) return '';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${span.start}/${span.end}`,
    details: ev.description,
    location: ev.location,
    ctz: 'Europe/Berlin',
  });

  return `https://calendar.google.com/calendar/render?${params}`;
};
