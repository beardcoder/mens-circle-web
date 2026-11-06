import { expect, test } from 'bun:test';

import { canonicalUrl } from '../src/lib/canonical';
import type { EventDTO } from '../src/lib/shared/dto';
import { dateStatus, eventView, splitFee } from '../src/lib/shared/event-status';
import { afterWords, splitText, splitWords } from '../src/lib/shared/words';

const event = (over: Partial<EventDTO> = {}): EventDTO => ({
  id: 'e1',
  title: 'Männerkreis',
  slug: '2026-09-18',
  description: '',
  event_date: '2026-09-18',
  start_time: '19:00',
  end_time: '21:30',
  location: 'Gemeindehaus',
  location_details: '',
  street: '',
  postal_code: '',
  city: 'Straubing',
  latitude: null,
  longitude: null,
  max_participants: 8,
  cost_basis: '',
  image_url: null,
  available_spots: 3,
  is_full: false,
  is_past: false,
  ...over,
});

test('splitFee: brackets, separators, nothing', () => {
  expect(splitFee('Auf Spendenbasis (Empfehlung 15–25 €)')).toEqual({
    main: 'Auf Spendenbasis',
    note: 'Empfehlung 15–25 €',
  });
  expect(splitFee('Spendenbasis, Richtwert 20 €')).toEqual({ main: 'Spendenbasis', note: 'Richtwert 20 €' });
  expect(splitFee('Spendenbasis; ab 10 €')).toEqual({ main: 'Spendenbasis', note: 'ab 10 €' });
  expect(splitFee('20 €')).toEqual({ main: '20 €', note: '' });
  expect(splitFee('   ')).toEqual({ main: 'Spendenbasis', note: 'Du gibst, was für dich machbar ist' });
  expect(splitFee()).toEqual(splitFee(''));
});

test('eventView: open, full and past', () => {
  const open = eventView(event(), 'Nächster Termin');

  expect(open.state).toBe('open');
  expect(open.title).toEqual(['Freitag,', '18. September 2026']);
  expect(open.datetime).toBe('2026-09-18');
  expect(open.facts).toEqual({
    time: '19:00–21:30 Uhr',
    place: 'Straubing',
    fee: 'Spendenbasis',
    seats: '3 von 8 Plätzen frei',
  });
  expect(open.seats).toEqual({ total: 8, free: 3 });
  expect(open.action).toEqual({ label: 'Zur Anmeldung', href: '/event/2026-09-18' });

  const full = eventView(event({ is_full: true, available_spots: 0 }), 'Termin');

  expect(full.state).toBe('full');
  expect(full.kicker).toBe('Termin · ausgebucht');
  expect(full.facts.seats).toBe('Ausgebucht · Warteliste');
  expect(full.action?.label).toBe('Auf die Warteliste');

  const past = eventView(event({ is_past: true }), 'Termin');

  expect(past.state).toBe('past');
  expect(past.seats).toBeNull();
  expect(past.action).toBeNull();
  expect(past.facts.seats).toBe('Hat stattgefunden');
  expect(eventView(event({ start_time: '' }), 'Termin', false).facts.time).toBe('Abends');
  expect(eventView(event(), 'Termin', false).action).toBeNull();
});

test('dateStatus: only a scheduled list has a next date', () => {
  expect(dateStatus('scheduled', event()).next?.slug).toBe('2026-09-18');
  expect(dateStatus('none', null).next).toBeNull();
  expect(dateStatus('unavailable', event()).next).toBeNull();
});

test('words: each word its index, tags and no-break spaces left alone', () => {
  const words = splitWords('Ein <em>ehrlicher</em> Abend – für dich');

  expect(words.count).toBe(5);
  expect(words.html).toContain('<em><span data-word class="inline-block" style="--i: 1">ehrlicher</span></em>');
  expect(words.html).toContain('Abend –</span>');
  expect(splitText('A & <b>').html).toContain('&amp;');
  expect(splitText('A & <b>').html).not.toContain('<b>');
  expect(afterWords(3, 0)).toBe('--enter-delay: 0.33s');
  expect(afterWords(3, 2)).toBe('--enter-delay: 0.53s');
});

test('canonical URLs drop trailing slashes, except the root', () => {
  const site = new URL('https://mens-circle.de');

  expect(canonicalUrl(site, '/')).toBe('https://mens-circle.de/');
  expect(canonicalUrl(site, '/event/')).toBe('https://mens-circle.de/event');
  expect(canonicalUrl(site, '/impressum//')).toBe('https://mens-circle.de/impressum');
});
