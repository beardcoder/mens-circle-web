import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { CARD_HEIGHT, CARD_WIDTH, cardContent, cardFingerprint, renderCard } from '../src/lib/server/og-card';

// Renders real PNGs. No database, no server, no network — satori embeds the
// glyph outlines from the two woff files in src/assets/fonts, and sharp only
// rasterises paths, so this needs no fonts installed on the machine. That is
// the property the whole card depends on in production, so it is asserted
// rather than assumed.

const input = {
  title: 'Männerkreis',
  eventDate: '2026-09-18T00:00:00.000Z',
  timeRange: '19:00–21:30 Uhr',
  place: 'Straubing',
  isPast: false,
  isFull: false,
  availableSpots: 4,
  maxParticipants: 12,
};

/** Width/height straight out of the PNG's IHDR chunk. */
function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

test('the card renders at exactly the size the meta tags declare', async () => {
  const png = await renderCard(cardContent(input));
  expect(pngSize(png)).toEqual({ width: CARD_WIDTH, height: CARD_HEIGHT });

  // PNG magic — a truncated or error body would not carry it.
  expect(Array.from(png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);

  // WhatsApp refuses to render a preview image much past ~600KB, and every
  // byte is on a crawler's clock. Ours land around 35KB.
  expect(png.byteLength).toBeLessThan(300 * 1024);
});

test('the card actually has ink on it', async () => {
  // A card whose text silently failed to render is the exact failure mode of
  // the sharp-only approach this replaced: a correctly sized, blank rectangle.
  // So count dark pixels rather than trusting that it drew.
  const png = await renderCard(cardContent(input));
  const sharp = (await import('sharp')).default;
  const { data } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  let dark = 0;
  for (let i = 0; i < data.length; i++) if (data[i] < 80) dark++;
  expect(dark).toBeGreaterThan(5000);
});

test('the card says what state the evening is in', () => {
  expect(cardContent(input).status).toBe('Noch 4 von 12 Plätzen frei');
  expect(cardContent({ ...input, isFull: true, availableSpots: 0 }).status).toBe('Ausgebucht · Warteliste offen');
  expect(cardContent({ ...input, isPast: true }).status).toBe('Vergangenes Treffen');
  expect(cardContent({ ...input, maxParticipants: 0 }).status).toBe('Anmeldung offen');
});

test('the brand always leads; a themed evening adds its name, a generic one does not', () => {
  expect(cardContent(input).kicker).toBe('Männerkreis Straubing');
  expect(cardContent({ ...input, title: '' }).kicker).toBe('Männerkreis Straubing');
  expect(cardContent({ ...input, title: 'Wintersonnwende' }).kicker).toBe('Männerkreis Straubing · Wintersonnwende');
});

test('date, weekday and meta line come from the record', () => {
  const content = cardContent(input);
  expect(content.weekday).toBe('Freitag');
  expect(content.date).toBe('18. September 2026');
  expect(content.meta).toBe('19:00–21:30 Uhr · Straubing');
});

test('an unreadable date still produces a card rather than an exception', async () => {
  const content = cardContent({ ...input, eventDate: 'not-a-date', timeRange: '' });
  expect(content.date).toBe('Termin folgt');
  expect(content.weekday).toBe('');
  const png = await renderCard(content);
  expect(pngSize(png)).toEqual({ width: CARD_WIDTH, height: CARD_HEIGHT });
});

test('the longest German date still renders at full size', async () => {
  // "30. SEPTEMBER 2026" is the widest line the layout has to hold; the size
  // step-down exists for it.
  const png = await renderCard(
    cardContent({ ...input, eventDate: '2026-09-30T00:00:00.000Z', place: 'Straubing-Sand' }),
  );
  expect(pngSize(png)).toEqual({ width: CARD_WIDTH, height: CARD_HEIGHT });
});

test('an identical card is drawn once and reused', async () => {
  // The seat state is part of the key, so this is not "cache anything that
  // looks alike" — it is "do not redraw a picture we already have".
  const content = cardContent({ ...input, place: 'Reuse-Test' });

  const first = await renderCard(content);
  const second = await renderCard(cardContent({ ...input, place: 'Reuse-Test' }));
  expect(second).toBe(first);

  // A taken seat changes what the card says, so it must not come back cached.
  const filled = await renderCard(cardContent({ ...input, place: 'Reuse-Test', availableSpots: 3 }));
  expect(filled).not.toBe(first);
  expect(cardFingerprint(content)).not.toBe(cardFingerprint(cardContent({ ...input, availableSpots: 3 })));
});

test('concurrent requests for one card share a single render', async () => {
  const content = cardContent({ ...input, place: 'Herd-Test' });
  const [a, b, c] = await Promise.all([renderCard(content), renderCard(content), renderCard(content)]);
  expect(b).toBe(a);
  expect(c).toBe(a);
});

test('the event page can state the card size without loading the renderer', () => {
  // satori and sharp cost ~46MB of RSS. pages/event/[slug].astro needs two
  // integers, so it must read them from the dependency-free module.
  const page = readFileSync(new URL('../src/pages/event/[slug].astro', import.meta.url), 'utf8');
  expect(page).toContain("from '@lib/og-card-size'");
  expect(page).not.toContain("from '@lib/server/og-card'");

  const sizes = readFileSync(new URL('../src/lib/og-card-size.ts', import.meta.url), 'utf8');
  expect(sizes).not.toMatch(/^import /m);
});
