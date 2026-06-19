/**
 * Pure string/date/address formatters (German locale), ported from the former
 * PocketBase `pb_hooks/lib/format.js`. Server-only.
 */
import type { Event } from './db/schema';

export function escapeHtml(str: unknown): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const WEEKDAYS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS_DE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

/** Parse a stored date string / value into a JS Date (or null). */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  let s = String(value).trim();
  if (s === '') return null;
  // Normalise "YYYY-MM-DD HH:MM:SS.sssZ" → ISO.
  s = s.replace(' ', 'T');
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Long German date: "Mittwoch, 15. Juli 2026". */
export function formatDateLongDE(value: unknown): string {
  const d = toDate(value);
  if (!d) return '';
  return `${WEEKDAYS_DE[d.getUTCDay()]}, ${d.getUTCDate()}. ${MONTHS_DE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Short German date: "15.07.2026". */
export function formatDateShortDE(value: unknown): string {
  const d = toDate(value);
  if (!d) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

/** "HH:MM – HH:MM Uhr" (empty if neither time is set). */
export function timeRangeText(ev: Pick<Event, 'startTime' | 'endTime'>): string {
  const st = ev.startTime || '';
  const et = ev.endTime || '';
  if (!st && !et) return '';
  return `${st}${et ? ` – ${et}` : ''} Uhr`;
}

/** Full street address from an event (or ""). */
export function fullAddress(ev: Pick<Event, 'street' | 'postalCode' | 'city'>): string {
  const street = ev.street || '';
  const postal = ev.postalCode || '';
  const city = ev.city || '';
  const parts: string[] = [];
  if (street) parts.push(street);
  const pc = [postal, city].filter(Boolean).join(' ');
  if (pc) parts.push(pc);
  return parts.join(', ');
}
