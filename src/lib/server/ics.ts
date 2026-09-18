import { toDate } from './format';

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

/** Wall-clock time as "20260918T190000"; the UTC fields hold Berlin local time. */
const icsLocal = (d: Date): string =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
  `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;

const combineDateTime = (eventDateValue: unknown, timeStr: string): Date | null => {
  const base = toDate(eventDateValue);
  if (!base) return null;
  const [h, m] = /^\d{1,2}:\d{2}/.test(timeStr ?? '')
    ? timeStr.split(':').map(Number)
    : [base.getUTCHours(), base.getUTCMinutes()];
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h, m, 0));
};

/** Start and end in Berlin wall-clock time; a missing end time means 90 minutes. */
const eventSpan = (ev: CalendarEvent): { start: string; end: string } | null => {
  const start = combineDateTime(ev.eventDate, ev.startTime);
  if (!start) return null;
  const end = combineDateTime(ev.eventDate, ev.endTime) ?? new Date(start.getTime() + 90 * 60 * 1000);
  return { start: icsLocal(start), end: icsLocal(end) };
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
    `DTSTAMP:${icsLocal(new Date())}Z`,
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
