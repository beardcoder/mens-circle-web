import { expect, test } from 'bun:test';

import { eventInputSchema } from '../src/lib/event-input';

test('blank optional form controls produce database-ready defaults', () => {
  // Astro turns empty strings into null before schema validation.
  const result = eventInputSchema.parse({
    title: '  Männerkreis  ',
    eventDate: '2026-11-12',
    slug: null,
    description: null,
    startTime: null,
    endTime: null,
    location: null,
    locationDetails: null,
    street: null,
    postalCode: null,
    city: null,
    latitude: null,
    longitude: null,
    maxParticipants: null,
    costBasis: null,
    imageUrl: null,
  });

  expect(result.title).toBe('Männerkreis');
  expect(result.eventDate).toBe('2026-11-12');
  expect(result.slug).toBeUndefined();
  expect(result.description).toBe('');
  expect(result.location).toBe('');
  expect(result.latitude).toBeNull();
  expect(result.longitude).toBeNull();
  expect(result.maxParticipants).toBe(8);
  expect(result.imageUrl).toBeNull();
  expect(result.isPublished).toBe(false);
});

test('edits preserve prose and accept numeric controls as strings', () => {
  const result = eventInputSchema.parse({
    title: 'Kreis',
    eventDate: '2026-11-12T00:00:00.000Z',
    slug: '  november  ',
    description: '  First paragraph\n\nSecond paragraph  ',
    latitude: '48.88',
    longitude: '12.57',
    maxParticipants: '12',
    isPublished: true,
    imageUrl: '  https://example.invalid/photo.jpg  ',
  });

  expect(result.slug).toBe('november');
  expect(result.description).toBe('  First paragraph\n\nSecond paragraph  ');
  expect(result.latitude).toBe(48.88);
  expect(result.longitude).toBe(12.57);
  expect(result.maxParticipants).toBe(12);
  expect(result.isPublished).toBe(true);
  expect(result.imageUrl).toBe('https://example.invalid/photo.jpg');
});

test('required fields cannot be blank, omitted or null', () => {
  for (const value of ['', '  ', undefined, null]) {
    expect(eventInputSchema.safeParse({ title: value, eventDate: '2026-11-12' }).success).toBe(false);
    expect(eventInputSchema.safeParse({ title: 'Kreis', eventDate: value }).success).toBe(false);
  }
});

const base = { title: 'Kreis', eventDate: '2026-11-12' };

const errorsFor = (input: Record<string, unknown>) => {
  const result = eventInputSchema.safeParse({ ...base, ...input });

  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
};

test('slugs are lowercase words joined by single hyphens, at most 80 characters', () => {
  for (const slug of ['november', '2026-11-12', 'abend-2', 'a'.repeat(80)]) expect(errorsFor({ slug })).toEqual({});

  for (const slug of ['Abend', 'a/b', 'a b', 'a&b', '-a', 'a-', 'a--b', 'männer', 'a'.repeat(81)]) {
    expect(errorsFor({ slug }).slug).toBeString();
  }
});

test('the date must be a real calendar day', () => {
  expect(eventInputSchema.parse({ ...base, eventDate: '2028-02-29' }).eventDate).toBe('2028-02-29');

  for (const eventDate of ['2026-02-30', '2026-13-01', '12.11.2026', 'morgen', '2026-11-12T19:00:00Z']) {
    expect(errorsFor({ eventDate }).eventDate).toBeString();
  }
});

test('times are HH:MM and the end comes after the start', () => {
  expect(errorsFor({ startTime: '19:00', endTime: '21:30' })).toEqual({});
  expect(errorsFor({ startTime: '19:00' })).toEqual({});
  expect(errorsFor({ startTime: '7 Uhr' }).startTime).toBeString();
  expect(errorsFor({ startTime: '25:00' }).startTime).toBeString();
  expect(errorsFor({ startTime: '19:00', endTime: '18:00' }).endTime).toBe('Das Ende liegt nach dem Beginn.');
  expect(errorsFor({ startTime: '19:00', endTime: '19:00' }).endTime).toBeString();
  expect(errorsFor({ endTime: '21:00' }).startTime).toBeString();
});

test('capacity is a whole number from 1 to 200; blank means 8', () => {
  expect(eventInputSchema.parse({ ...base, maxParticipants: '' }).maxParticipants).toBe(8);
  expect(eventInputSchema.parse({ ...base, maxParticipants: '200' }).maxParticipants).toBe(200);

  for (const maxParticipants of ['0', '-3', '2.5', '201', 'acht', 0]) {
    expect(errorsFor({ maxParticipants }).maxParticipants).toBeString();
  }
});

test('coordinates stay in range; a comma decimal is accepted', () => {
  expect(eventInputSchema.parse({ ...base, latitude: '48,88', longitude: '-12.5' })).toMatchObject({
    latitude: 48.88,
    longitude: -12.5,
  });
  expect(errorsFor({ latitude: '91' }).latitude).toBeString();
  expect(errorsFor({ latitude: 'Nord' }).latitude).toBeString();
  expect(errorsFor({ longitude: '-181' }).longitude).toBeString();
});

test('an image address must be https', () => {
  expect(errorsFor({ imageUrl: 'https://example.invalid/a.jpg' })).toEqual({});

  for (const imageUrl of ['http://example.invalid/a.jpg', 'javascript:alert(1)', 'bild.jpg', '//example.invalid/a']) {
    expect(errorsFor({ imageUrl }).imageUrl).toBeString();
  }
});
