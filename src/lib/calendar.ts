/**
 * Calendar Integration — pure URL/string builders.
 *
 * Generates an ICS calendar string (+ a blob URL wrapping it) and a Google
 * Calendar deep link from event data. No DOM, no side effects beyond the
 * blob-URL builder's `URL.createObjectURL` call.
 *
 * Note: the ICS builder parses `${date}T${time}:00` as *local* time, then
 * serialises via `toISOString()` (UTC) — this matches the source behavior and
 * is preserved intentionally. The Google URL keeps the raw local components.
 */

import type { EventData } from './types';

function formatICSDate(date: string, time: string): string {
  const d = new Date(`${date}T${time}:00`);

  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Build the raw ICS (VCALENDAR/VEVENT) string for an event.
 *
 * PRODID `-//Männerkreis Niederbayern/ Straubing//DE`, timezone Europe/Berlin.
 */
export function buildIcsString(event: EventData): string {
  const start = formatICSDate(event.startDate, event.startTime);
  const end = formatICSDate(event.endDate, event.endTime);
  const stamp = formatICSDate(
    new Date().toISOString().slice(0, 10),
    new Date().toISOString().slice(11, 16)
  );

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Männerkreis Niederbayern/ Straubing//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `DTSTAMP:${stamp}`,
    `UID:${Date.now()}@maennerkreis-straubing.de`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n');
}

/**
 * Wrap the ICS string in a Blob and return an object URL. The caller owns the
 * URL's lifetime and must `URL.revokeObjectURL()` it when done.
 */
export function buildIcsBlobUrl(event: EventData): string {
  const blob = new Blob([buildIcsString(event)], {
    type: 'text/calendar;charset=utf-8',
  });

  return URL.createObjectURL(blob);
}

/**
 * Build a Google Calendar "add event" deep link. Dates are formatted
 * `YYYYMMDDTHHMM00` in local components, with `ctz=Europe/Berlin`.
 */
export function buildGoogleCalendarUrl(event: EventData): string {
  const formatDate = (date: string, time: string): string =>
    `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatDate(event.startDate, event.startTime)}/${formatDate(event.endDate, event.endTime)}`,
    details: event.description,
    location: event.location,
    ctz: 'Europe/Berlin',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
