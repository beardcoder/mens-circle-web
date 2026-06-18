/**
 * Pure string / date / address formatters. No dependencies — shared by the email
 * templates, the ICS builder and the public DTOs. Ported 1:1 from the former
 * PocketBase `pb_hooks/lib/format.js` (German locale, UTC-based date parts so the
 * stored wall-clock time is rendered verbatim, exactly as PocketBase did).
 */

export function escapeHtml(str: unknown): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function nl2br(str: unknown): string {
  return escapeHtml(str).replace(/\n/g, '<br />');
}

const WEEKDAYS_DE = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
];
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

/** Parse any stored date value (Date | ISO string | epoch) into a JS Date. */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  let s = String(value).trim();
  if (s === '') return null;
  s = s.replace(' ', 'T');
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Long German date: "Mittwoch, 15. Juli 2026". */
export function formatDateLongDE(value: unknown): string {
  const d = toDate(value);
  if (!d) return '';
  return `${WEEKDAYS_DE[d.getUTCDay()]}, ${d.getUTCDate()}. ${
    MONTHS_DE[d.getUTCMonth()]
  } ${d.getUTCFullYear()}`;
}

/** Short German date: "15.07.2026". */
export function formatDateShortDE(value: unknown): string {
  const d = toDate(value);
  if (!d) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

/** "HH:MM – HH:MM Uhr" (empty when neither time is set). */
export function timeRangeText(
  startTime?: string | null,
  endTime?: string | null,
): string {
  const st = startTime || '';
  const et = endTime || '';
  if (!st && !et) return '';
  return `${st}${et ? ` – ${et}` : ''} Uhr`;
}

/** Full street address from the parts (or ""). */
export function fullAddress(parts: {
  street?: string | null;
  postal_code?: string | null;
  city?: string | null;
}): string {
  const street = parts.street || '';
  const postal = parts.postal_code || '';
  const city = parts.city || '';
  const out: string[] = [];
  if (street) out.push(street);
  const pc = [postal, city].filter(Boolean).join(' ');
  if (pc) out.push(pc);
  return out.join(', ');
}
