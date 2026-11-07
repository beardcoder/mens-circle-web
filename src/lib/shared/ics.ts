/**
 * One evening as a calendar entry: an iCalendar file (RFC 5545 with the RFC 7986
 * additions Apple Calendar reads) and the matching Google Calendar link. Apple's own
 * fields (`X-APPLE-STRUCTURED-LOCATION` for the map and travel time,
 * `X-APPLE-TRAVEL-ADVISORY-BEHAVIOR` for "time to leave") are written the way Apple
 * Calendar exports them; other calendars ignore them.
 */
import site from '../../data/site.json';
import { fullAddress } from './format';
import { zonedTime } from './time';

/** What a calendar entry needs; built from an event by `calendarEventFrom`. */
export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  /** The venue's name ("Gemeindehaus"). */
  location: string;
  /** Street, postal code and city, or ''. */
  address: string;
  /** How to find the room, from the admin ("Eingang über den Hof"). */
  locationDetails: string;
  costBasis: string;
  latitude: number | null;
  longitude: number | null;
  /** The event page, absolute. */
  url: string;
  /** ISO timestamp of the last edit; the calendar replaces an older copy by it. */
  updatedAt?: string;
}

/** Both shapes the site holds an event in: the database row and the public DTO. */
type EventSource =
  | {
      id: string;
      title: string;
      slug: string;
      description: string;
      eventDate: string;
      startTime: string;
      endTime: string;
      location: string;
      locationDetails: string;
      street: string;
      postalCode: string;
      city: string;
      costBasis: string;
      latitude: number | null;
      longitude: number | null;
      updatedAt?: string;
    }
  | {
      id: string;
      title: string;
      slug: string;
      description: string;
      event_date: string;
      start_time: string;
      end_time: string;
      location: string;
      location_details: string;
      street: string;
      postal_code: string;
      city: string;
      cost_basis: string;
      latitude: number | null;
      longitude: number | null;
    };

export const calendarEventFrom = (ev: EventSource, siteUrl: string | URL): CalendarEvent => {
  const row =
    'eventDate' in ev
      ? ev
      : {
          ...ev,
          eventDate: ev.event_date,
          startTime: ev.start_time,
          endTime: ev.end_time,
          locationDetails: ev.location_details,
          postalCode: ev.postal_code,
          costBasis: ev.cost_basis,
          updatedAt: undefined,
        };

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventDate: row.eventDate,
    startTime: row.startTime,
    endTime: row.endTime,
    location: row.location,
    address: fullAddress(row),
    locationDetails: row.locationDetails,
    costBasis: row.costBasis,
    latitude: row.latitude,
    longitude: row.longitude,
    url: new URL(`/event/${row.slug}`, siteUrl).href,
    updatedAt: row.updatedAt,
  };
};

/** TEXT escaping (RFC 5545 3.3.11): backslash, semicolon, comma and line breaks. */
const icsEscape = (text: unknown): string =>
  String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');

/** A quoted parameter value: no double quotes allowed inside, so they become single ones. */
const param = (text: string): string => `"${text.replace(/"/g, "'").replace(/\r\n|\r|\n/g, ' ')}"`;

const encoder = new TextEncoder();

/**
 * Folds a content line at 75 octets (RFC 5545 3.1): CRLF and one space, never inside
 * a UTF-8 sequence ("ä" is two octets).
 */
const fold = (line: string): string => {
  const parts: string[] = [];
  let current = '';
  let octets = 0;

  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;

    if (octets + size > limit) {
      parts.push(current);
      current = '';
      octets = 0;
    }

    current += char;
    octets += size;
  }

  parts.push(current);

  return parts.join('\r\n ');
};

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

/** The venue as one line: "Gemeindehaus, Teststraße 1, 94315 Straubing". */
const place = (ev: CalendarEvent): string => [ev.location, ev.address].filter(Boolean).join(', ');

/** The notes of the entry: the evening, how to find the room, the fee, the page. */
const notes = (ev: CalendarEvent): string =>
  [
    ev.description.trim(),
    ev.locationDetails.trim() && `So findest du hin: ${ev.locationDetails.trim()}`,
    ev.costBasis.trim() && `Beitrag: ${ev.costBasis.trim()}`,
    `Alle Infos zum Abend: ${ev.url}`,
    `Fragen: ${site.contactEmail}`,
  ]
    .filter(Boolean)
    .join('\n\n');

const hasGeo = (ev: CalendarEvent): ev is CalendarEvent & { latitude: number; longitude: number } =>
  ev.latitude !== null && ev.longitude !== null;

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Berlin',
  'X-LIC-LOCATION:Europe/Berlin',
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
];

/** Where and how far: the plain location, the coordinates and Apple's map pin. */
const locationLines = (ev: CalendarEvent): string[] => {
  const where = place(ev);
  const lines = where ? [`LOCATION:${icsEscape(where)}`] : [];

  if (!hasGeo(ev)) return lines;

  return [
    ...lines,
    `GEO:${ev.latitude};${ev.longitude}`,
    // Apple Calendar shows a map and computes travel time from this.
    `X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS=${param(ev.address || where)};X-APPLE-RADIUS=70;` +
      `X-TITLE=${param(ev.location || ev.address || site.siteName)}:geo:${ev.latitude},${ev.longitude}`,
  ];
};

/** One reminder the evening before and one an hour before the start. */
const alarms = (ev: CalendarEvent): string[] =>
  [
    ['-P1D', `Morgen: ${ev.title}`],
    ['-PT1H', `In einer Stunde: ${ev.title}`],
  ].flatMap(([trigger, text]) => [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `TRIGGER:${trigger}`,
    `DESCRIPTION:${icsEscape(text)}`,
    'END:VALARM',
  ]);

export const buildIcs = (ev: CalendarEvent, now: Date = new Date()): string => {
  const span = eventSpan(ev);

  if (!span) return '';

  const modified = ev.updatedAt ? new Date(ev.updatedAt) : null;
  const stamp = icsUtc(now);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${site.siteName}//Website//DE`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(site.siteName)}`,
    `NAME:${icsEscape(site.siteName)}`,
    'X-WR-TIMEZONE:Europe/Berlin',
    ...VTIMEZONE,
    'BEGIN:VEVENT',
    `UID:${ev.id}@mens-circle.de`,
    `DTSTAMP:${stamp}`,
    ...(modified && !Number.isNaN(modified.getTime())
      ? [`LAST-MODIFIED:${icsUtc(modified)}`, `SEQUENCE:${Math.floor(modified.getTime() / 1000)}`]
      : []),
    `DTSTART;TZID=Europe/Berlin:${span.start}`,
    `DTEND;TZID=Europe/Berlin:${span.end}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    `DESCRIPTION:${icsEscape(notes(ev))}`,
    ...locationLines(ev),
    `URL;VALUE=URI:${ev.url}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'CLASS:PUBLIC',
    `CATEGORIES:${icsEscape(site.siteName)}`,
    // RFC 7986: a CSS colour name, close to the site's ember.
    'COLOR:sienna',
    ...(hasGeo(ev) ? ['X-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC'] : []),
    ...alarms(ev),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `${lines.map(fold).join('\r\n')}\r\n`;
};

/** The same entry as a Google Calendar template link, or empty without a date. */
export const googleCalendarUrl = (ev: CalendarEvent): string => {
  const span = eventSpan(ev);

  if (!span) return '';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${span.start}/${span.end}`,
    details: notes(ev),
    location: place(ev),
    ctz: 'Europe/Berlin',
  });

  return `https://calendar.google.com/calendar/render?${params}`;
};
