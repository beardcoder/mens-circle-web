/// <reference path="../pb_data/types.d.ts" />

// Shared library for the Männerkreis PocketBase hooks.
// NOT named *.pb.js so PocketBase does NOT auto-load it as a hook file.
// Require it from any *.pb.js with:  const lib = require(`${__hooks}/lib.js`)
//
// Contains: config (env-backed), formatters, ICS builder, mail helper, and the
// German email HTML renderers returning { subject, html }.

// ---------------------------------------------------------------------------
// Config (read from env via $os.getenv with sensible defaults)
// ---------------------------------------------------------------------------
function env(key, fallback) {
  try {
    const v = $os.getenv(key);
    return v && v.length > 0 ? v : fallback;
  } catch (e) {
    return fallback;
  }
}

// Parse a comma-separated list of integers (e.g. "1,3,4") into a number array.
function parseIntList(raw) {
  if (!raw) return [];
  var out = [];
  String(raw)
    .split(",")
    .forEach(function (s) {
      var token = s.trim();
      if (token === "") return;
      var n = parseInt(token, 10);
      // listmonk's admin API expects numeric list IDs, not UUIDs. A UUID here
      // would silently become NaN and drop out — log it loudly so the
      // misconfiguration is obvious instead of "nobody gets assigned".
      if (isNaN(n) || String(n) !== token) {
        $app.logger().warn(
          "parseIntList: ignoring non-numeric list id — expected the numeric listmonk list ID, not a UUID",
          "value",
          token,
        );
        return;
      }
      out.push(n);
    });
  return out;
}

const config = {
  APP_URL: env("APP_URL", "https://mens-circle.de"),
  SITE_NAME: env("SITE_NAME", "Männerkreis Niederbayern/ Straubing"),
  MAIL_FROM_ADDRESS: env("MAIL_FROM_ADDRESS", "hallo@mens-circle.de"),
  MAIL_FROM_NAME: env("MAIL_FROM_NAME", "Männerkreis Niederbayern/ Straubing"),
  MAIL_ADMIN_ADDRESS: env("MAIL_ADMIN_ADDRESS", "hallo@mens-circle.de"),
  MAIL_ADMIN_NAME: env("MAIL_ADMIN_NAME", "Männerkreis Admin"),
  CONTACT_EMAIL: env("MAIL_CONTACT_ADDRESS", "hallo@mens-circle.de"),

  // listmonk — newsletter subscribers + campaigns now live here (not PocketBase).
  // The public subscribe route forwards new sign-ups to listmonk's admin API;
  // sending campaigns, double opt-in and unsubscribe are handled inside listmonk.
  LISTMONK_URL: env("LISTMONK_URL", "").replace(/\/+$/, ""),
  LISTMONK_API_USER: env("LISTMONK_API_USER", ""),
  LISTMONK_API_TOKEN: env("LISTMONK_API_TOKEN", ""),
  LISTMONK_LIST_IDS: parseIntList(env("LISTMONK_LIST_IDS", "")),
};

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------
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

// Build the full street address from an event record (or null).
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

// ---------------------------------------------------------------------------
// ICS (iCalendar) builder — VCALENDAR with TZID Europe/Berlin
// ---------------------------------------------------------------------------
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

// Combine event_date (date) + "HH:MM" time string into a Date (treated as Europe/Berlin wall time).
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

// ---------------------------------------------------------------------------
// Mail helper
// ---------------------------------------------------------------------------
// Send an email. options: { to, subject, html }
// Never throws — logs and returns false on failure so callers don't 500.
//
// NOTE: We deliberately do NOT attach the .ics file. On the target PocketBase
// 0.39.3 JSVM, MailerMessage.attachments is map[string]io.Reader and the
// $filesystem.fileFromBytes(...) result cannot be converted to an io.Reader,
// which throws. Instead, the event calendar file is offered as a hosted
// download link (icsUrl) rendered inside the email templates.
function sendMail(app, options) {
  try {
    const msg = new MailerMessage({
      from: { address: config.MAIL_FROM_ADDRESS, name: config.MAIL_FROM_NAME },
      to: [{ address: options.to }],
      subject: options.subject,
      html: options.html,
    });

    app.newMailClient().send(msg);
    return true;
  } catch (e) {
    app.logger().error("sendMail failed", "to", options.to, "subject", options.subject, "error", String(e));
    return false;
  }
}

// Build the public hosted-download URL for an event's calendar (.ics) file.
function icsUrlFor(slug) {
  return `${config.APP_URL}/api/public/events/${slug}/ics`;
}

// ---------------------------------------------------------------------------
// listmonk integration — newsletter subscribers + campaigns
// ---------------------------------------------------------------------------
// All newsletter data and sending lives in listmonk now. The public subscribe
// route forwards a sign-up to listmonk's admin API; listmonk owns the double
// opt-in confirmation, the campaign sending and the unsubscribe flow.

// True only when the listmonk admin API is fully configured via env.
function listmonkConfigured() {
  return (
    config.LISTMONK_URL.length > 0 &&
    config.LISTMONK_API_USER.length > 0 &&
    config.LISTMONK_API_TOKEN.length > 0 &&
    config.LISTMONK_LIST_IDS.length > 0
  );
}

// Low-level call to the listmonk admin API. Never throws — returns the raw
// PocketBase $http response (or null on transport failure).
function listmonkRequest(method, path, bodyObj) {
  try {
    return $http.send({
      url: config.LISTMONK_URL + path,
      method: method,
      // listmonk v2+ supports API tokens via the "token user:token" scheme.
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "token " + config.LISTMONK_API_USER + ":" + config.LISTMONK_API_TOKEN,
      },
      body: bodyObj ? JSON.stringify(bodyObj) : undefined,
      timeout: 15,
    });
  } catch (err) {
    $app.logger().error("listmonk request failed", "path", path, "error", String(err));
    return null;
  }
}

// Subscribe an email to the configured listmonk list(s).
// Returns { ok, status } where status is one of:
//   "subscribed" — newly added (listmonk sends opt-in if the list is double opt-in)
//   "exists"     — the address is already a subscriber
//   "error"      — listmonk rejected the request or is unreachable
function subscribeToListmonk(email, name) {
  if (!listmonkConfigured()) {
    $app.logger().error("listmonk not configured — set LISTMONK_URL / LISTMONK_API_USER / LISTMONK_API_TOKEN / LISTMONK_LIST_IDS");
    return { ok: false, status: "error" };
  }

  // Adding without preconfirm lets listmonk drive the (double) opt-in flow per
  // the list configuration. A non-empty name is required by some listmonk
  // builds, so fall back to the address.
  const res = listmonkRequest("POST", "/api/subscribers", {
    email: email,
    name: name && name.trim() ? name.trim() : email,
    status: "enabled",
    lists: config.LISTMONK_LIST_IDS,
    preconfirm_subscriptions: false,
  });

  if (!res) return { ok: false, status: "error" };

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return { ok: true, status: "subscribed" };
  }

  // 409 = the email is already a subscriber in listmonk.
  if (res.statusCode === 409) {
    return { ok: true, status: "exists" };
  }

  let detail = "";
  try {
    detail = JSON.stringify(res.json);
  } catch (e) {
    detail = "";
  }
  $app.logger().error("listmonk subscribe rejected", "email", email, "status", res.statusCode, "body", detail);
  return { ok: false, status: "error" };
}

// ---------------------------------------------------------------------------
// Email renderers — each returns { subject, html }
//
// The HTML body markup now lives in Go html/template files under
// `pb_hooks/views/emails/*.html`, rendered via PocketBase's `$template`.
// Subjects are still built here in JS (event title / heute|morgen interpolation).
//
// Data-key contract (per template): scalar string fields are auto-escaped by
// the template engine. Fields whose VALUE is trusted HTML (admin newsletter
// body, or `nl2br`-converted free text) are rendered in the templates with the
// documented `{{.field|raw}}` helper and therefore must be passed as already-
// safe HTML strings (we run them through `nl2br`/`escapeHtml` here first).
// ---------------------------------------------------------------------------

// Render a body template (defines block "body") composed with the shared layout.
function renderEmail(name, data) {
  return $template
    .loadFiles(
      `${__hooks}/views/emails/layout.html`,
      `${__hooks}/views/emails/${name}.html`
    )
    .render(data);
}

// Build the "HH:MM – HH:MM Uhr" string (empty if neither time set).
function timeRangeText(ev) {
  const st = ev.getString("start_time");
  const et = ev.getString("end_time");
  if (!st && !et) return "";
  return `${st || ""}${et ? " – " + et : ""} Uhr`;
}

// Shared event detail data passed to the templates. Scalar (auto-escaped) values
// plus `locationDetails` which is `nl2br`-converted trusted HTML (rendered raw).
function eventDetailData(ev, opts) {
  opts = opts || {};
  const ld = ev.getString("location_details");
  return {
    dateLong: formatDateLongDE(ev.get("event_date")),
    timeRange: timeRangeText(ev),
    location: ev.getString("location"),
    address: opts.includeAddress ? fullAddress(ev) : "",
    locationDetails: ld ? nl2br(ld) : "",
  };
}

// (1) Event registration confirmation
function renderRegistrationConfirmation(ev, participant) {
  const firstName = participant.getString("first_name") || "";
  const subject = `Anmeldebestätigung: ${ev.getString("title")}`;
  const data = Object.assign(eventDetailData(ev, { includeAddress: true }), {
    firstName: firstName,
    eventTitle: ev.getString("title"),
    description: nl2br(ev.getString("description")),
    costBasis: ev.getString("cost_basis"),
    contactEmail: config.CONTACT_EMAIL,
    siteName: config.SITE_NAME,
    recipientEmail: participant.getString("email"),
    icsUrl: icsUrlFor(ev.getString("slug")),
  });
  return { subject, html: renderEmail("registration-confirmation", data) };
}

// (3) Waitlist confirmation
function renderWaitlistConfirmation(ev, participant) {
  const firstName = participant.getString("first_name") || "";
  const subject = `Warteliste: ${ev.getString("title")}`;
  const data = Object.assign(eventDetailData(ev, { includeAddress: false }), {
    firstName: firstName,
    eventTitle: ev.getString("title"),
    contactEmail: config.CONTACT_EMAIL,
    siteName: config.SITE_NAME,
    recipientEmail: participant.getString("email"),
  });
  return { subject, html: renderEmail("waitlist-confirmation", data) };
}

// (2) Admin new-registration notification
function renderAdminNotification(ev, participant, activeCount) {
  const subject = `Neue Anmeldung: ${ev.getString("title")}`;
  const name = `${participant.getString("first_name") || ""} ${
    participant.getString("last_name") || ""
  }`.trim();
  const data = {
    eventTitle: ev.getString("title"),
    participantName: name,
    participantEmail: participant.getString("email"),
    participantPhone: participant.getString("phone"),
    dateShort: formatDateShortDE(ev.get("event_date")),
    timeRange: timeRangeText(ev),
    location: ev.getString("location"),
    activeCount: activeCount,
    maxParticipants: ev.get("max_participants"),
  };
  return { subject, html: renderEmail("admin-registration", data) };
}

// (4) Waitlist promotion
function renderWaitlistPromotion(ev, participant) {
  const firstName = participant.getString("first_name") || "";
  const subject = `Ein Platz ist frei – ${ev.getString("title")}`;
  const data = Object.assign(eventDetailData(ev, { includeAddress: true }), {
    firstName: firstName,
    eventTitle: ev.getString("title"),
    description: nl2br(ev.getString("description")),
    costBasis: ev.getString("cost_basis"),
    contactEmail: config.CONTACT_EMAIL,
    siteName: config.SITE_NAME,
    recipientEmail: participant.getString("email"),
    icsUrl: icsUrlFor(ev.getString("slug")),
  });
  return { subject, html: renderEmail("waitlist-promotion", data) };
}

// (5) Event reminder
function renderEventReminder(ev, participant, isToday) {
  const firstName = participant.getString("first_name") || "";
  const whenWord = isToday ? "heute" : "morgen";
  const whenWordCap = isToday ? "Heute" : "Morgen";
  const closingWord = isToday ? "gleich" : "morgen";
  const subject = `Erinnerung: ${ev.getString("title")} ist ${whenWord}!`;
  const data = Object.assign(eventDetailData(ev, { includeAddress: false }), {
    firstName: firstName,
    eventTitle: ev.getString("title"),
    whenWord: whenWord,
    whenWordCap: whenWordCap,
    closingWord: closingWord,
    description: nl2br(ev.getString("description")),
    costBasis: ev.getString("cost_basis"),
    contactEmail: config.CONTACT_EMAIL,
    siteName: config.SITE_NAME,
    recipientEmail: participant.getString("email"),
  });
  return { subject, html: renderEmail("event-reminder", data) };
}

// Newsletter welcome + campaign emails now live in listmonk (subscriber
// management, double opt-in confirmation and campaign sending), so the former
// renderNewsletterWelcome / renderNewsletterCampaign renderers were removed.

// (6) Event participant message. mailContent = admin-authored HTML with
// {first_name} already replaced. Rendered UNESCAPED via `{{.content|raw}}`.
function renderEventParticipantMessage(subjectLine, mailContent, ev) {
  const data = {
    content: mailContent,
    eventTitle: ev.getString("title"),
    siteName: config.SITE_NAME,
  };
  return { subject: subjectLine, html: renderEmail("event-participant-message", data) };
}

// ---------------------------------------------------------------------------
// Domain helpers shared by routes / hooks / cron
// ---------------------------------------------------------------------------

// Count active registrations (status registered|attended, not soft-deleted) for an event.
function countActiveRegistrations(app, eventId) {
  try {
    const recs = app.findRecordsByFilter(
      "registrations",
      "event = {:eid} && deleted = null && (status = 'registered' || status = 'attended')",
      "",
      0,
      0,
      { eid: eventId }
    );
    return recs.length;
  } catch (e) {
    return 0;
  }
}

// Is the event in the past? (end of its day has passed)
function isEventPast(ev) {
  const d = toDate(ev.get("event_date"));
  if (!d) return false;
  const endOfDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59)
  );
  return endOfDay.getTime() < Date.now();
}

// Build the public DTO for an event record.
function eventDto(app, ev) {
  const activeCount = countActiveRegistrations(app, ev.id);
  const max = ev.getInt ? ev.getInt("max_participants") : ev.get("max_participants");
  const available = Math.max(0, max - activeCount);

  let imageUrl = null;
  const imageName = ev.getString("image");
  if (imageName) {
    let base = config.APP_URL;
    try {
      const settings = app.settings();
      if (settings && settings.meta && settings.meta.appURL) {
        base = settings.meta.appURL;
      }
    } catch (e) {
      // fall back to config.APP_URL
    }
    imageUrl = `${base}/api/files/${ev.collection().id}/${ev.id}/${imageName}`;
  }

  return {
    id: ev.id,
    title: ev.getString("title"),
    slug: ev.getString("slug"),
    description: ev.getString("description"),
    event_date: ev.getString("event_date"),
    start_time: ev.getString("start_time"),
    end_time: ev.getString("end_time"),
    location: ev.getString("location"),
    location_details: ev.getString("location_details"),
    street: ev.getString("street"),
    postal_code: ev.getString("postal_code"),
    city: ev.getString("city"),
    latitude: ev.get("latitude"),
    longitude: ev.get("longitude"),
    max_participants: max,
    cost_basis: ev.getString("cost_basis"),
    image_url: imageUrl,
    available_spots: available,
    is_full: available <= 0,
    is_past: isEventPast(ev),
  };
}

// Find or create a participant by email; update name/phone on hit.
function upsertParticipant(app, email, fields) {
  let participant = null;
  try {
    participant = app.findFirstRecordByFilter(
      "participants",
      "email = {:email}",
      { email: email }
    );
  } catch (e) {
    participant = null;
  }

  if (!participant) {
    const col = app.findCollectionByNameOrId("participants");
    participant = new Record(col);
    participant.set("email", email);
  }
  if (fields) {
    if (fields.first_name !== undefined && fields.first_name !== null && fields.first_name !== "") {
      participant.set("first_name", fields.first_name);
    }
    if (fields.last_name !== undefined && fields.last_name !== null && fields.last_name !== "") {
      participant.set("last_name", fields.last_name);
    }
    if (fields.phone !== undefined && fields.phone !== null && fields.phone !== "") {
      participant.set("phone", fields.phone);
    }
  }
  app.save(participant);
  return participant;
}

module.exports = {
  config,
  // utils
  escapeHtml,
  nl2br,
  randomToken,
  toDate,
  formatDateLongDE,
  formatDateShortDE,
  fullAddress,
  buildIcs,
  icsUrlFor,
  sendMail,
  // listmonk
  listmonkConfigured,
  subscribeToListmonk,
  // domain helpers
  countActiveRegistrations,
  isEventPast,
  eventDto,
  upsertParticipant,
  // renderers
  renderRegistrationConfirmation,
  renderWaitlistConfirmation,
  renderAdminNotification,
  renderWaitlistPromotion,
  renderEventReminder,
  renderEventParticipantMessage,
};
