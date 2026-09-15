import { expect, test } from 'bun:test';
import { buildEventMeta, eventCardUrl, eventPlace, eventWhenWhere, stripHtml } from '../src/lib/event-meta';
import { buildEventSchema } from '../src/lib/event-schema';
import type { EventDTO } from '../src/lib/types';

// Pure string/JSON-LD assertions — no database, no server, no fetch. The two
// modules under test only reach into src/data/site.json and lib/server/format,
// both of which are plain data and pure functions.

const SITE = new URL('https://mens-circle.de');

const event = (overrides: Partial<EventDTO> = {}): EventDTO => ({
  id: 'evt-1',
  title: 'Männerkreis',
  slug: '2026-09-18',
  description: 'Ein Abend über Grenzen. Wir beginnen mit einer Runde.',
  event_date: '2026-09-18T00:00:00.000Z',
  start_time: '19:00',
  end_time: '21:30',
  location: 'Praxis Sommer',
  location_details: '',
  street: 'Ahornstraße 15',
  postal_code: '94315',
  city: 'Straubing',
  latitude: 48.8777,
  longitude: 12.5731,
  max_participants: 12,
  cost_basis: 'Spendenbasis',
  image_url: null,
  available_spots: 4,
  is_full: false,
  is_past: false,
  ...overrides,
});

test('the share title and description carry date, time, place and seats', () => {
  const meta = buildEventMeta(event(), SITE);

  // The single question a forwarded link has to answer, in the bold line.
  expect(meta.ogTitle).toBe('Männerkreis am Freitag, 18. September 2026 in Straubing');
  // The <title> stays short enough to survive a SERP and names the brand once.
  expect(meta.title).toBe('Männerkreis am 18. September 2026 – Männerkreis Straubing');
  expect(meta.title.length).toBeLessThanOrEqual(60);

  expect(meta.description).toContain('Freitag, 18. September 2026, 19:00–21:30 Uhr in Straubing');
  expect(meta.description).toContain('Noch 4 von 12 Plätzen frei.');
  // The evening's own first sentence closes it out.
  expect(meta.description).toContain('Ein Abend über Grenzen.');
  expect(meta.description.length).toBeLessThanOrEqual(200);

  expect(meta.details).toEqual([
    { label: 'Termin', value: 'Freitag, 18. September 2026, 19:00–21:30 Uhr' },
    { label: 'Ort', value: 'Straubing' },
  ]);
});

test('a full evening offers the waiting list, a past one says so', () => {
  expect(buildEventMeta(event({ is_full: true, available_spots: 0 }), SITE).description).toContain('ausgebucht');
  expect(buildEventMeta(event({ is_past: true }), SITE).description).toContain('bereits stattgefunden');
  // No seat count is promised in either state.
  expect(buildEventMeta(event({ is_past: true }), SITE).description).not.toContain('Plätzen frei');
});

test('the brand is appended once, never twice', () => {
  // An empty admin title falls back to the circle's own name — appending the
  // site name again would say "Männerkreis Straubing … – Männerkreis Straubing".
  const meta = buildEventMeta(event({ title: '   ' }), SITE);
  expect(meta.title).toBe('Männerkreis Straubing am 18. September 2026');
  expect(buildEventMeta(event({ title: 'Wintersonnwende' }), SITE).title).toBe(
    'Wintersonnwende am 18. September 2026 – Männerkreis Straubing',
  );
});

test("the share card is this evening's generated poster, at a known size", () => {
  const meta = buildEventMeta(event(), SITE);
  expect(meta.image).toMatch(/^https:\/\/mens-circle\.de\/event\/2026-09-18\/card\.png\?v=[a-z0-9]+$/);
  // The evening has no picture of its own, so nothing extra goes to the graph.
  expect(meta.extraImage).toBeNull();
});

test('the card URL changes whenever anything the card draws changes', () => {
  // Facebook and WhatsApp keep a scraped image for a long time and key it by
  // URL. A filling evening whose card URL stayed put would keep sending out a
  // picture that says seats are free.
  const base = eventCardUrl(event(), SITE);
  const changed = [
    { available_spots: 3 },
    { is_full: true },
    { is_past: true },
    { start_time: '18:00' },
    { city: 'Regensburg' },
    { title: 'Wintersonnwende' },
    { event_date: '2026-09-19T00:00:00.000Z' },
  ];
  for (const patch of changed) {
    expect(eventCardUrl(event(patch), SITE)).not.toBe(base);
  }
  // …and is stable for anything it does not draw.
  expect(eventCardUrl(event({ description: 'anderer Text' }), SITE)).toBe(base);
});

test("the admin's own picture rides along as a second image, never as the card", () => {
  const own = buildEventMeta(event({ image_url: 'https://cdn.example/abend.jpg' }), SITE);
  expect(own.image).toContain('/card.png');
  expect(own.extraImage).toBe('https://cdn.example/abend.jpg');

  // Unusable admin input is dropped rather than emitted as a broken image.
  for (const bad of ['javascript:alert(1)', '   ', 'http://[bad']) {
    expect(buildEventMeta(event({ image_url: bad }), SITE).extraImage).toBeNull();
  }
});

test('missing or unparseable dates never produce a half-written line', () => {
  const meta = buildEventMeta(event({ event_date: 'not-a-date', start_time: '', end_time: '' }), SITE);
  expect(meta.ogTitle).toBe('Männerkreis in Straubing');
  expect(meta.title).toBe('Männerkreis – Männerkreis Straubing');
  expect(meta.description.startsWith('Männerkreis in Straubing.')).toBe(true);
  expect(eventWhenWhere(event({ event_date: '', start_time: '', end_time: '' }))).toBe('Männerkreis in Straubing');
});

test('the place falls back city → venue → home town', () => {
  expect(eventPlace(event())).toBe('Straubing');
  expect(eventPlace(event({ city: '' }))).toBe('Praxis Sommer');
  expect(eventPlace(event({ city: '', location: '' }))).toBe('Straubing');
});

test('markup is stripped until stable, so nothing escapes into a JSON-LD script', () => {
  // The point is not a pretty result but that no tag survives: a single pass
  // leaves "</script>" behind on nested markup, and that alone would break out
  // of the JSON-LD block these strings are embedded in.
  const residue = stripHtml('<scr<script>ipt>alert(1)</script>');
  expect(residue).not.toContain('<');
  expect(residue.toLowerCase()).not.toContain('script>');
  expect(stripHtml('a\n\n  b')).toBe('a b');
  expect(buildEventMeta(event({ description: '<b>Fett</b> und klar.' }), SITE).description).toContain('Fett und klar.');
});

test('the Event node joins the site graph instead of starting a second one', () => {
  const schema = buildEventSchema(event(), SITE);
  const url = 'https://mens-circle.de/event/2026-09-18';

  // /event references the meeting as `subEvent: { '@id': <canonical url> }`.
  // Without this id that reference dangles.
  expect(schema['@id']).toBe(url);
  expect(schema.url).toBe(url);
  expect(schema.superEvent).toMatchObject({ '@id': 'https://mens-circle.de/#series' });
  expect(schema.organizer).toMatchObject({ '@id': 'https://mens-circle.de/#organization' });

  expect(schema.startDate).toBe('2026-09-18T19:00:00+02:00');
  expect(schema.endDate).toBe('2026-09-18T21:30:00+02:00');
  expect(schema.maximumAttendeeCapacity).toBe(12);
  expect(schema.remainingAttendeeCapacity).toBe(4);
  expect(schema.image).toHaveLength(1);
  expect(String((schema.image as string[])[0])).toContain('/event/2026-09-18/card.png');
  expect(schema.offers).toMatchObject({ availability: 'https://schema.org/InStock', validThrough: schema.startDate });
});

test('availability and seat counts stay honest for full and past evenings', () => {
  const full = buildEventSchema(event({ is_full: true, available_spots: 0 }), SITE);
  expect(full.offers).toMatchObject({ availability: 'https://schema.org/SoldOut' });
  expect(full).not.toHaveProperty('remainingAttendeeCapacity');

  // A past evening cannot be booked either — "InStock" there is a claim that
  // gets an Event rich result pulled.
  const past = buildEventSchema(event({ is_past: true }), SITE);
  expect(past.offers).toMatchObject({ availability: 'https://schema.org/SoldOut' });
  expect(past).not.toHaveProperty('remainingAttendeeCapacity');
  expect(past.maximumAttendeeCapacity).toBe(12);

  // No capacity claims at all when the evening has no seat limit.
  const open = buildEventSchema(event({ max_participants: 0 }), SITE);
  expect(open).not.toHaveProperty('maximumAttendeeCapacity');
  expect(open).not.toHaveProperty('remainingAttendeeCapacity');
});

test('an evening with no text of its own still gets a description', () => {
  const schema = buildEventSchema(event({ description: '' }), SITE);
  expect(String(schema.description)).toContain('18. September 2026');
});

test('winter dates get the winter offset', () => {
  const schema = buildEventSchema(event({ event_date: '2026-01-15T00:00:00.000Z' }), SITE);
  expect(schema.startDate).toBe('2026-01-15T19:00:00+01:00');
});
