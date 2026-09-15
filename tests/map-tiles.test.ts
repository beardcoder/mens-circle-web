import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// Reads the island's source, like tests/frontend-performance.test.ts reads
// public/sw.js. No DOM, no browser, no network.
//
// The point of this file: the basemap moved once already, because CARTO began
// asking for an API key for `basemaps.cartocdn.com`. There is no account to
// hang a key on here, and a key shipped in a client bundle is public anyway —
// so "the tile source needs no key" is a property worth pinning down rather
// than remembering.

const source = readFileSync(new URL('../src/components/islands/EventMap.svelte', import.meta.url), 'utf8');

/** The same file with comments removed. The comments name the providers that
 *  were rejected and why, so a "no keyed provider appears here" check has to
 *  look at the code rather than the prose explaining it. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** The `L.tileLayer(...)` URL template the island actually uses. */
const tileUrl = source.match(/const TILE_URL = '([^']+)'/)?.[1] ?? '';

test('the basemap is configured from one named constant', () => {
  expect(tileUrl).not.toBe('');
  expect(code).toContain('L.tileLayer(TILE_URL');
});

test('the tile URL carries no key, token or account of any kind', () => {
  for (const marker of ['key=', 'apikey', 'api_key', 'access_token', 'accessToken', '?token', 'appid']) {
    expect(tileUrl.toLowerCase()).not.toContain(marker.toLowerCase());
  }
  // The template's only placeholders are Leaflet's own.
  expect(tileUrl.match(/\{[a-z]+\}/g)?.sort()).toEqual(['{s}', '{x}', '{y}', '{z}']);
});

test('the host is one of the providers that serve without an account', () => {
  // Verified by request against each of these, with a browser User-Agent and a
  // mens-circle.de Referer: they answer 200. Stadia answers 401 and Wikimedia
  // 403 for third-party use, and CARTO is what this moved away from — so those
  // must never come back.
  const KEYLESS_HOSTS = ['tile.openstreetmap.fr', 'tile.openstreetmap.org', 'tile.openstreetmap.de'];
  const host = new URL(tileUrl.replace('{s}.', 'a.')).host;
  expect(KEYLESS_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))).toBe(true);

  for (const keyed of ['cartocdn', 'stadiamaps', 'maptiler', 'mapbox', 'thunderforest', 'geoapify', 'maps.wikimedia']) {
    expect(code).not.toContain(keyed);
  }
});

test('the tiles are credited, since every one of these requires attribution', () => {
  const attribution = source.match(/const TILE_ATTRIBUTION =([\s\S]*?);\n/)?.[1] ?? '';
  expect(attribution).toContain('openstreetmap.org/copyright');
  // Whoever renders and hosts the style gets named too, not just the data.
  expect(attribution).toContain('hotosm.org');
  expect(attribution).toContain('openstreetmap.fr');
});

test('a tile outage degrades to a sentence instead of an empty box', () => {
  // The address and the route links live in the section around the island, so
  // there is always something useful left; a silent grey rectangle would just
  // make the reader wonder whether the venue is the problem.
  expect(code).toContain("tiles.on('tileerror'");
  expect(code).toContain("state = 'failed'");
  expect(code).toContain('event-map__fallback');
  // And the reserved 16/9 frame is released, or the fallback sits alone in a
  // large empty rectangle.
  expect(code).toContain("event-map__frame:has(.event-map[data-state='failed'])");
});
