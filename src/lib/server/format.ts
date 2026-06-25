import type { Event } from './db/schema';

export const escapeHtml = (str: unknown): string => {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const WEEKDAYS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  let s = String(value).trim();
  if (s === '') return null;
  s = s.replace(' ', 'T');
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDateLongDE = (value: unknown): string => {
  const d = toDate(value);
  if (!d) return '';
  return `${WEEKDAYS_DE[d.getUTCDay()]}, ${d.getUTCDate()}. ${MONTHS_DE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

export const formatDateShortDE = (value: unknown): string => {
  const d = toDate(value);
  if (!d) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
};

export const timeRangeText = (ev: Pick<Event, 'startTime' | 'endTime'>): string => {
  const st = ev.startTime || '';
  const et = ev.endTime || '';
  if (!st && !et) return '';
  return `${st}${et ? ` – ${et}` : ''} Uhr`;
};

export const fullAddress = (ev: Pick<Event, 'street' | 'postalCode' | 'city'>): string =>
  [ev.street, [ev.postalCode, ev.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
