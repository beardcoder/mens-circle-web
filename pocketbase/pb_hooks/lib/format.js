/// <reference path="../../pb_data/types.d.ts" />

// Pure string/date/address formatters. No dependencies on other lib modules.

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(str) {
  return escapeHtml(str).replace(/\n/g, "<br />");
}

function randomToken(length) {
  const len = length || 64;
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

const WEEKDAYS_DE = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];
const MONTHS_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

// Parse a PocketBase date string / value into a JS Date.
function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  // PB stores dates like "2026-07-15 19:00:00.000Z"
  let s = String(value).trim();
  if (s === "") return null;
  // Normalise "YYYY-MM-DD HH:MM:SS.sssZ" to ISO
  s = s.replace(" ", "T");
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Long German date: "Mittwoch, 15. Juli 2026"
function formatDateLongDE(value) {
  const d = toDate(value);
  if (!d) return "";
  return `${WEEKDAYS_DE[d.getUTCDay()]}, ${d.getUTCDate()}. ${
    MONTHS_DE[d.getUTCMonth()]
  } ${d.getUTCFullYear()}`;
}

// Short German date: "15.07.2026"
function formatDateShortDE(value) {
  const d = toDate(value);
  if (!d) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

// Build the full street address from an event record (or "").
function fullAddress(ev) {
  const street = (ev.getString && ev.getString("street")) || "";
  const postal = (ev.getString && ev.getString("postal_code")) || "";
  const city = (ev.getString && ev.getString("city")) || "";
  const parts = [];
  if (street) parts.push(street);
  const pc = [postal, city].filter(Boolean).join(" ");
  if (pc) parts.push(pc);
  return parts.join(", ");
}

module.exports = {
  escapeHtml,
  nl2br,
  randomToken,
  toDate,
  formatDateLongDE,
  formatDateShortDE,
  fullAddress,
};
