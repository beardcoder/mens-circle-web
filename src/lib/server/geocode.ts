/**
 * The venue's coordinates from its address, for the admin (never a visitor's
 * address). OpenStreetMap's Nominatim, server-side, under its usage policy: an
 * identifying User-Agent, at most one request a second for the whole process, and
 * a per-admin hourly limit in the action.
 */
import { config } from './config';

let nextAllowed = 0;

export interface Coordinates {
  latitude: number;
  longitude: number;
  label: string;
}

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const wait = nextAllowed - Date.now();

  if (wait > 0) await Bun.sleep(wait);

  nextAllowed = Date.now() + 1100;

  const url = new URL('https://nominatim.openstreetmap.org/search');

  url.search = new URLSearchParams({ q: address, format: 'jsonv2', limit: '1', countrycodes: 'de' }).toString();

  const response = await fetch(url, {
    headers: { 'User-Agent': `mens-circle-web (+${config.APP_URL})`, 'Accept-Language': 'de' },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) throw new Error(`geocoder answered ${response.status}`);

  const [hit] = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;

  if (!hit) return null;

  return {
    latitude: Math.round(Number(hit.lat) * 1e6) / 1e6,
    longitude: Math.round(Number(hit.lon) * 1e6) / 1e6,
    label: hit.display_name,
  };
}
