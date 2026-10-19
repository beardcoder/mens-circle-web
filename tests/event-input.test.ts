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
  expect(result.eventDate).toBe('2026-11-12T00:00:00.000Z');
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
