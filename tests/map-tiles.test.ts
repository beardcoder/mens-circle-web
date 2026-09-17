import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// Reads the island's source. No DOM, no browser, no network.
//
// The basemap moved once already, when CARTO began asking for an API key. There
// is no account to hang a key on and a key in a client bundle is public anyway,
// so "the tile source needs no key" is pinned down here rather than remembered.

const source = readFileSync(new URL('../src/components/islands/EventMap.svelte', import.meta.url), 'utf8');

/** The same file without comments: those name the rejected providers, so the
 *  "no keyed provider appears here" check must look at the code alone. */
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
  // Verified by request with a browser User-Agent and a mens-circle.de Referer:
  // these answer 200. Stadia answers 401, Wikimedia 403, and CARTO is what this
  // moved away from.
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
  // The address and route links live around the island, so something useful is
  // always left.
  expect(code).toContain("tiles.on('tileerror'");
  expect(code).toContain("state = 'failed'");
  expect(code).toContain('event-map__fallback');
  // The reserved 16/9 frame is released, or the fallback sits in an empty box.
  expect(code).toContain("event-map__frame:has(.event-map[data-state='failed'])");
});
