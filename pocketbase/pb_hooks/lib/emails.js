/// <reference path="../../pb_data/types.d.ts" />

// Email renderers — each returns { subject, html }.
//
// The HTML body markup lives in Go html/template files under
// `pb_hooks/views/emails/*.html`, rendered via PocketBase's `$template`.
// Subjects are built here in JS (event title / heute|morgen interpolation).
//
// Data-key contract (per template): scalar string fields are auto-escaped by
// the template engine. Fields whose VALUE is trusted HTML (admin newsletter
// body, or `nl2br`-converted free text) are rendered in the templates with the
// documented `{{.field|raw}}` helper and therefore must be passed as already-
// safe HTML strings (we run them through `nl2br`/`escapeHtml` here first).

const { config } = require(`${__hooks}/lib/config.js`);
const {
  nl2br,
  fullAddress,
  formatDateLongDE,
  formatDateShortDE,
} = require(`${__hooks}/lib/format.js`);
const { icsUrlFor } = require(`${__hooks}/lib/mail.js`);

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

module.exports = {
  renderRegistrationConfirmation,
  renderWaitlistConfirmation,
  renderAdminNotification,
  renderWaitlistPromotion,
  renderEventReminder,
  renderEventParticipantMessage,
};
