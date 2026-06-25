import type { Event } from './db/schema';
import { fullAddress, toDate } from './format';

const icsEscape = (text: unknown): string =>
  String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');

const pad = (n: number) => String(n).padStart(2, '0');

const icsLocal = (d: Date): string =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
  `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;

const icsUtc = (d: Date): string => `${icsLocal(d)}Z`;

const combineDateTime = (eventDateValue: unknown, timeStr: string): Date | null => {
  const base = toDate(eventDateValue);
  if (!base) return null;
  const [h, m] = /^\d{1,2}:\d{2}/.test(timeStr ?? '')
    ? timeStr.split(':').map(Number)
    : [base.getUTCHours(), base.getUTCMinutes()];
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h, m, 0));
};

export const buildIcs = (ev: Event): string => {
  const start = combineDateTime(ev.eventDate, ev.startTime);
  const end = combineDateTime(ev.eventDate, ev.endTime) || (start ? new Date(start.getTime() + 90 * 60 * 1000) : null);
  if (!start || !end) return '';

  const uid = `${ev.id}@mens-circle.de`;
  const summary = icsEscape(ev.title);
  const location = icsEscape([ev.location, fullAddress(ev)].filter(Boolean).join(', '));
  const description = icsEscape(ev.description);

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
    `UID:${uid}`,
    `DTSTAMP:${icsUtc(new Date())}`,
    `DTSTART;TZID=Europe/Berlin:${icsLocal(start)}`,
    `DTEND;TZID=Europe/Berlin:${icsLocal(end)}`,
    `SUMMARY:${summary}`,
    ...(location ? [`LOCATION:${location}`] : []),
    ...(description ? [`DESCRIPTION:${description}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
};
