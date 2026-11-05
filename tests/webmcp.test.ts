import { expect, test } from 'bun:test';

import type { PublicEvent } from '../src/components/event/types';
import { eventsText, type Field, readInput } from '../src/lib/webmcp';

// What an agent reads back from the WebMCP tools: the dates in one line each, and for a
// form either nothing filled in with the reasons, or the trimmed values.

const fields: Field[] = [
  { name: 'first_name', description: '', required: true, maxLength: 5 },
  { name: 'email', description: '', required: true, maxLength: 254, email: true },
  { name: 'note', description: '', maxLength: 20 },
];

test('valid input is trimmed and optional fields may stay empty', () => {
  expect(readInput(fields, { first_name: ' Max ', email: 'max@example.org' })).toEqual({
    values: { first_name: 'Max', email: 'max@example.org', note: '' },
    problems: [],
  });
});

test('every problem is named at once, in words to correct', () => {
  const { problems } = readInput(fields, {
    first_name: 'Maximilian',
    email: 'kein-at',
    note: 'x'.repeat(21),
    extra: 1,
  });

  expect(problems).toEqual([
    'first_name darf höchstens 5 Zeichen haben.',
    'email ist keine gültige E-Mail-Adresse.',
    'note darf höchstens 20 Zeichen haben.',
  ]);
  expect(readInput(fields, { email: 42 }).problems).toEqual(['first_name fehlt.', 'email fehlt.']);
});

const event = (slug: string, title: [string, string], places: string): PublicEvent => ({
  id: slug,
  slug,
  availableSpots: 3,
  maxParticipants: 8,
  isPast: false,
  view: {
    state: 'open',
    kicker: 'Nächster Termin',
    title,
    datetime: '2099-01-01',
    rows: [
      { label: 'Zeit', value: '19:00–21:30 Uhr' },
      { label: 'Plätze', value: places },
    ],
    seats: { total: 8, free: 3 },
    action: null,
  },
});

test('the dates read as one line each, with the page to register on', () => {
  const text = eventsText(
    { events: [event('a', ['Donnerstag,', '1. Januar 2099'], '3 von 8 Plätzen frei')] },
    'https://example.org',
  );

  expect(text).toBe(
    'Kommende Abende (1):\n- Donnerstag, 1. Januar 2099 · Zeit: 19:00–21:30 Uhr; Plätze: 3 von 8 Plätzen frei · Anmeldung: https://example.org/event/a#anmeldung',
  );
});

test('no date planned points to the notification', () => {
  expect(eventsText({ events: [] }, 'https://example.org')).toContain('https://example.org/event#benachrichtigung');
});
