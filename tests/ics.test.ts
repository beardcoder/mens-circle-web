import { expect, test } from 'bun:test';

import { buildIcs, calendarEventFrom, googleCalendarUrl } from '../src/lib/shared/ics';

const row = {
  id: 'e1',
  title: 'Männerkreis',
  slug: '2026-07-15',
  description: 'Ein Abend im Kreis.\nMit Zeit zum Zuhören; ohne Ratschläge, ohne Druck.',
  eventDate: '2026-07-15',
  startTime: '19:00',
  endTime: '21:30',
  location: 'Gemeindehaus St. Jakob',
  locationDetails: 'Eingang über den Hof, erster Stock',
  street: 'Pfarrplatz 1',
  postalCode: '94315',
  city: 'Straubing',
  costBasis: 'Spendenbasis (Empfehlung 15–25 €)',
  latitude: 48.8818,
  longitude: 12.5734,
  updatedAt: '2026-07-01T10:00:00.000Z',
};

const ev = calendarEventFrom(row, 'https://mens-circle.de');
const now = new Date('2026-07-02T08:00:00Z');

/** The file with its folded lines joined again (RFC 5545 3.1). */
const unfolded = (ics: string) => ics.replace(/\r\n /g, '');

test('times are Berlin wall clock; a missing or early end means 90 minutes', () => {
  const ics = buildIcs(ev, now);

  expect(ics).toContain('DTSTART;TZID=Europe/Berlin:20260715T190000');
  expect(ics).toContain('DTEND;TZID=Europe/Berlin:20260715T213000');
  expect(ics).toContain('DTSTAMP:20260702T080000Z');
  expect(buildIcs({ ...ev, endTime: '' })).toContain('DTEND;TZID=Europe/Berlin:20260715T203000');
  expect(buildIcs({ ...ev, startTime: '23:00', endTime: '' })).toContain('DTEND;TZID=Europe/Berlin:20260716T003000');
  expect(buildIcs({ ...ev, endTime: '18:00' })).toContain('DTEND;TZID=Europe/Berlin:20260715T203000');
  expect(buildIcs({ ...ev, startTime: '' })).toBe('');
});

test('the entry carries everything Apple Calendar shows', () => {
  const ics = unfolded(buildIcs(ev, now));

  expect(ics).toContain('SUMMARY:Männerkreis');
  expect(ics).toContain('LOCATION:Gemeindehaus St. Jakob\\, Pfarrplatz 1\\, 94315 Straubing');
  expect(ics).toContain('GEO:48.8818;12.5734');
  expect(ics).toContain(
    'X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS="Pfarrplatz 1, 94315 Straubing";X-APPLE-RADIUS=70;X-TITLE="Gemeindehaus St. Jakob":geo:48.8818,12.5734',
  );
  expect(ics).toContain('X-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC');
  expect(ics).toContain('URL;VALUE=URI:https://mens-circle.de/event/2026-07-15');
  expect(ics).toContain('LAST-MODIFIED:20260701T100000Z');
  expect(ics).toContain('STATUS:CONFIRMED');
  expect(ics).toContain('TRIGGER:-P1D');
  expect(ics).toContain('TRIGGER:-PT1H');
  // The notes: description, the way in, the fee and the page, escaped.
  expect(ics).toContain('DESCRIPTION:Ein Abend im Kreis.\\nMit Zeit zum Zuhören\\; ohne Ratschläge\\, ohne Druck.');
  expect(ics).toContain('So findest du hin: Eingang über den Hof\\, erster Stock');
  expect(ics).toContain('Beitrag: Spendenbasis (Empfehlung 15–25 €)');
  expect(ics).toContain('Alle Infos zum Abend: https://mens-circle.de/event/2026-07-15');
});

test('without coordinates there is no map pin', () => {
  const ics = buildIcs({ ...ev, latitude: null, longitude: null }, now);

  expect(ics).not.toContain('GEO:');
  expect(ics).not.toContain('X-APPLE-STRUCTURED-LOCATION');
  expect(ics).not.toContain('X-APPLE-TRAVEL-ADVISORY-BEHAVIOR');
});

test('lines fold at 75 octets without splitting a character, and end in CRLF', () => {
  const ics = buildIcs({ ...ev, description: 'Grüße aus dem Kreis. '.repeat(20) }, now);

  for (const line of ics.split('\r\n')) {
    expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(line).not.toContain('�');
  }

  expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  expect(unfolded(ics)).toContain(`DESCRIPTION:${'Grüße aus dem Kreis. '.repeat(20).trim()}`);
});

test('the public DTO and the database row give the same entry', () => {
  const dto = calendarEventFrom(
    {
      ...row,
      event_date: row.eventDate,
      start_time: row.startTime,
      end_time: row.endTime,
      location_details: row.locationDetails,
      postal_code: row.postalCode,
      cost_basis: row.costBasis,
    },
    'https://mens-circle.de',
  );

  expect({ ...dto, updatedAt: row.updatedAt } as typeof ev).toEqual(ev);
});

test('the Google link carries the same time, place and notes', () => {
  const url = new URL(googleCalendarUrl(ev));

  expect(url.searchParams.get('dates')).toBe('20260715T190000/20260715T213000');
  expect(url.searchParams.get('ctz')).toBe('Europe/Berlin');
  expect(url.searchParams.get('location')).toBe('Gemeindehaus St. Jakob, Pfarrplatz 1, 94315 Straubing');
  expect(url.searchParams.get('details')).toContain('So findest du hin');
});
