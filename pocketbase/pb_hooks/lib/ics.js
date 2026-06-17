/// <reference path="../../pb_data/types.d.ts" />

// ICS (iCalendar) builder — VCALENDAR with TZID Europe/Berlin.

const { toDate, fullAddress } = require(`${__hooks}/lib/format.js`);

function icsEscape(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// Format a JS Date as a floating local datetime "YYYYMMDDTHHMMSS" (used with TZID).
function icsLocal(d) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

function icsUtc(d) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

// Combine event_date (date) + "HH:MM" time string into a Date (Europe/Berlin wall time).
function combineDateTime(eventDateValue, timeStr) {
  const base = toDate(eventDateValue);
  if (!base) return null;
  let h = base.getUTCHours();
  let m = base.getUTCMinutes();
  if (timeStr && /^\d{1,2}:\d{2}/.test(timeStr)) {
    const parts = timeStr.split(":");
    h = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
  }
  return new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h, m, 0)
  );
}

// Build an ICS string for an event record.
function buildIcs(ev) {
  const start = combineDateTime(ev.get("event_date"), ev.getString("start_time"));
  const end =
    combineDateTime(ev.get("event_date"), ev.getString("end_time")) ||
    (start ? new Date(start.getTime() + 90 * 60 * 1000) : null);
  if (!start) return "";

  const uid = `${ev.id}@mens-circle.de`;
  const now = new Date();
  const summary = icsEscape(ev.getString("title"));
  const location = icsEscape(
    [ev.getString("location"), fullAddress(ev)].filter(Boolean).join(", ")
  );
  const description = icsEscape(ev.getString("description"));

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Maennerkreis Niederbayern Straubing//PocketBase//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Berlin",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "TZNAME:CEST",
    "DTSTART:19700329T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "TZNAME:CET",
    "DTSTART:19701025T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsUtc(now)}`,
    `DTSTART;TZID=Europe/Berlin:${icsLocal(start)}`,
    `DTEND;TZID=Europe/Berlin:${icsLocal(end)}`,
    `SUMMARY:${summary}`,
  ];
  if (location) lines.push(`LOCATION:${location}`);
  if (description) lines.push(`DESCRIPTION:${description}`);
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}

module.exports = { buildIcs };
