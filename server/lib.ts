/**
 * EmDash — shared utilities (config, date formatting, ICS, mail, email templates).
 *
 * Port of the former PocketBase `pb_hooks/lib.js` into TypeScript for the
 * embedded Bun backend. Email rendering uses simple string templates instead
 * of the PocketBase Go template engine.
 */

// ── Config ────────────────────────────────────────────────────────────────────

function env(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  APP_URL: env('APP_URL', 'https://mens-circle.de'),
  SITE_NAME: env('SITE_NAME', 'Männerkreis Niederbayern/ Straubing'),
  MAIL_FROM_ADDRESS: env('MAIL_FROM_ADDRESS', 'hallo@mens-circle.de'),
  MAIL_FROM_NAME: env('MAIL_FROM_NAME', 'Männerkreis Niederbayern/ Straubing'),
  MAIL_ADMIN_ADDRESS: env('MAIL_ADMIN_ADDRESS', 'hallo@mens-circle.de'),
  MAIL_ADMIN_NAME: env('MAIL_ADMIN_NAME', 'Männerkreis Admin'),
  CONTACT_EMAIL: env('MAIL_CONTACT_ADDRESS', 'hallo@mens-circle.de'),
};

// ── Small utilities ───────────────────────────────────────────────────────────

export function escapeHtml(str: string | null | undefined): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function nl2br(str: string): string {
  return escapeHtml(str).replace(/\n/g, '<br />');
}

export function randomToken(length = 64): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
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

export function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  let s = String(value).trim();
  if (s === '') return null;
  s = s.replace(' ', 'T');
  if (!s.endsWith('Z') && !s.includes('+')) s += 'Z';
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateLongDE(value: string | null | undefined): string {
  const d = toDate(value);
  if (!d) return '';
  return `${WEEKDAYS_DE[d.getUTCDay()]}, ${d.getUTCDate()}. ${MONTHS_DE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatDateShortDE(value: string | null | undefined): string {
  const d = toDate(value);
  if (!d) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

// ── ICS builder ───────────────────────────────────────────────────────────────

function icsEscape(text: string): string {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function icsLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

function icsUtc(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

function combineDateTime(eventDateValue: string, timeStr: string): Date | null {
  const base = toDate(eventDateValue);
  if (!base) return null;
  let h = base.getUTCHours();
  let m = base.getUTCMinutes();
  if (timeStr && /^\d{1,2}:\d{2}/.test(timeStr)) {
    const parts = timeStr.split(':');
    h = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
  }
  return new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate(),
      h,
      m,
      0,
    ),
  );
}

export interface EventRow {
  id: string;
  title: string;
  slug: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string;
  location_details: string;
  street: string;
  postal_code: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  max_participants: number;
  cost_basis: string;
  image_url: string | null;
  is_published: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParticipantRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export function fullAddress(ev: EventRow): string {
  const parts: string[] = [];
  if (ev.street) parts.push(ev.street);
  const pc = [ev.postal_code, ev.city].filter(Boolean).join(' ');
  if (pc) parts.push(pc);
  return parts.join(', ');
}

export function buildIcs(ev: EventRow): string {
  const start = combineDateTime(ev.event_date, ev.start_time);
  const end =
    combineDateTime(ev.event_date, ev.end_time) ||
    (start ? new Date(start.getTime() + 90 * 60 * 1000) : null);
  if (!start) return '';

  const uid = `${ev.id}@mens-circle.de`;
  const now = new Date();
  const summary = icsEscape(ev.title);
  const location = icsEscape(
    [ev.location, fullAddress(ev)].filter(Boolean).join(', '),
  );
  const description = icsEscape(ev.description);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Maennerkreis Niederbayern Straubing//EmDash//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Berlin',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsUtc(now)}`,
    `DTSTART;TZID=Europe/Berlin:${icsLocal(start)}`,
    `DTEND;TZID=Europe/Berlin:${icsLocal(end!)}`,
    `SUMMARY:${summary}`,
  ];
  if (location) lines.push(`LOCATION:${location}`);
  if (description) lines.push(`DESCRIPTION:${description}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n');
}

export function icsUrlFor(slug: string): string {
  return `${config.APP_URL}/api/public/events/${slug}/ics`;
}

// ── Mail helper ───────────────────────────────────────────────────────────────

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email via SMTP. Uses a simple fetch-based approach to an SMTP relay
 * or can be swapped for nodemailer. For now logs to console in dev; in
 * production, implement via the configured SMTP transport.
 */
export async function sendMail(options: MailOptions): Promise<boolean> {
  try {
    // In production, use an SMTP client. For the embedded approach we'll use
    // a lightweight transport. For now, we log and attempt a basic SMTP send.
    const smtpHost = process.env.SMTP_HOST;
    if (!smtpHost) {
      console.log(
        `[mail] SMTP not configured — would send to ${options.to}: ${options.subject}`,
      );
      return true;
    }

    // Use Bun's built-in capabilities or a lightweight mailer
    // For production: implement SMTP transport here
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USERNAME || '';
    const smtpPass = process.env.SMTP_PASSWORD || '';

    // Minimal SMTP implementation using TCP sockets
    const { createTransport } = await import('./mailer.ts');
    return await createTransport({
      host: smtpHost,
      port: smtpPort,
      auth: { user: smtpUser, pass: smtpPass },
    }).send({
      from: `${config.MAIL_FROM_NAME} <${config.MAIL_FROM_ADDRESS}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  } catch (e) {
    console.error('[mail] sendMail failed:', options.to, String(e));
    return false;
  }
}

// ── Domain helpers ────────────────────────────────────────────────────────────

export function isEventPast(ev: EventRow): boolean {
  const d = toDate(ev.event_date);
  if (!d) return false;
  const endOfDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59),
  );
  return endOfDay.getTime() < Date.now();
}

// ── Email renderers ───────────────────────────────────────────────────────────

function emailLayout(body: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;background-color:#efe9dd;color:#2c2418;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#efe9dd;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="padding:40px 32px;">
${body}
</td></tr>
<tr><td style="padding:16px 32px;background:#f8f4ee;font-size:12px;color:#8c7a68;text-align:center;">
${escapeHtml(config.SITE_NAME)}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function timeRangeText(ev: EventRow): string {
  if (!ev.start_time && !ev.end_time) return '';
  return `${ev.start_time || ''}${ev.end_time ? ' – ' + ev.end_time : ''} Uhr`;
}

export function renderRegistrationConfirmation(
  ev: EventRow,
  participant: ParticipantRow,
): { subject: string; html: string } {
  const subject = `Anmeldebestätigung: ${ev.title}`;
  const body = `
<h1 style="font-family:Georgia,serif;font-size:22px;color:#2c2418;margin:0 0 16px;">Anmeldebestätigung</h1>
<p style="font-size:16px;line-height:1.7;color:#5c4a3a;">Hallo ${escapeHtml(participant.first_name)},</p>
<p style="font-size:16px;line-height:1.7;color:#5c4a3a;">deine Anmeldung für <strong>${escapeHtml(ev.title)}</strong> war erfolgreich!</p>
<table role="presentation" style="margin:24px 0;font-size:15px;color:#5c4a3a;line-height:1.8;">
<tr><td style="padding-right:12px;font-weight:600;">Datum:</td><td>${escapeHtml(formatDateLongDE(ev.event_date))}</td></tr>
<tr><td style="padding-right:12px;font-weight:600;">Uhrzeit:</td><td>${escapeHtml(timeRangeText(ev))}</td></tr>
<tr><td style="padding-right:12px;font-weight:600;">Ort:</td><td>${escapeHtml(ev.location)}${ev.street ? '<br>' + escapeHtml(fullAddress(ev)) : ''}</td></tr>
${ev.location_details ? `<tr><td style="padding-right:12px;font-weight:600;">Hinweis:</td><td>${nl2br(ev.location_details)}</td></tr>` : ''}
${ev.cost_basis ? `<tr><td style="padding-right:12px;font-weight:600;">Kosten:</td><td>${escapeHtml(ev.cost_basis)}</td></tr>` : ''}
</table>
<p style="font-size:15px;line-height:1.7;color:#5c4a3a;"><a href="${escapeHtml(icsUrlFor(ev.slug))}" style="color:#8b5e3c;">📅 Termin zum Kalender hinzufügen</a></p>
<p style="font-size:14px;line-height:1.7;color:#8c7a68;margin-top:24px;">Bei Fragen erreichst du uns unter <a href="mailto:${escapeHtml(config.CONTACT_EMAIL)}" style="color:#8b5e3c;">${escapeHtml(config.CONTACT_EMAIL)}</a>.</p>`;
  return { subject, html: emailLayout(body) };
}

export function renderWaitlistConfirmation(
  ev: EventRow,
  participant: ParticipantRow,
): { subject: string; html: string } {
  const subject = `Warteliste: ${ev.title}`;
  const body = `
<h1 style="font-family:Georgia,serif;font-size:22px;color:#2c2418;margin:0 0 16px;">Warteliste</h1>
<p style="font-size:16px;line-height:1.7;color:#5c4a3a;">Hallo ${escapeHtml(participant.first_name)},</p>
<p style="font-size:16px;line-height:1.7;color:#5c4a3a;">leider ist <strong>${escapeHtml(ev.title)}</strong> bereits ausgebucht. Du stehst jetzt auf der Warteliste und wirst per E-Mail benachrichtigt, sobald ein Platz frei wird.</p>
<table role="presentation" style="margin:24px 0;font-size:15px;color:#5c4a3a;line-height:1.8;">
<tr><td style="padding-right:12px;font-weight:600;">Datum:</td><td>${escapeHtml(formatDateLongDE(ev.event_date))}</td></tr>
<tr><td style="padding-right:12px;font-weight:600;">Uhrzeit:</td><td>${escapeHtml(timeRangeText(ev))}</td></tr>
<tr><td style="padding-right:12px;font-weight:600;">Ort:</td><td>${escapeHtml(ev.location)}</td></tr>
</table>
<p style="font-size:14px;line-height:1.7;color:#8c7a68;margin-top:24px;">Bei Fragen erreichst du uns unter <a href="mailto:${escapeHtml(config.CONTACT_EMAIL)}" style="color:#8b5e3c;">${escapeHtml(config.CONTACT_EMAIL)}</a>.</p>`;
  return { subject, html: emailLayout(body) };
}

export function renderAdminNotification(
  ev: EventRow,
  participant: ParticipantRow,
  activeCount: number,
): { subject: string; html: string } {
  const subject = `Neue Anmeldung: ${ev.title}`;
  const name =
    `${participant.first_name} ${participant.last_name}`.trim() ||
    '(kein Name)';
  const body = `
<h1 style="font-family:Georgia,serif;font-size:22px;color:#2c2418;margin:0 0 16px;">Neue Anmeldung</h1>
<table role="presentation" style="font-size:15px;color:#5c4a3a;line-height:1.8;">
<tr><td style="padding-right:12px;font-weight:600;">Event:</td><td>${escapeHtml(ev.title)}</td></tr>
<tr><td style="padding-right:12px;font-weight:600;">Name:</td><td>${escapeHtml(name)}</td></tr>
<tr><td style="padding-right:12px;font-weight:600;">E-Mail:</td><td>${escapeHtml(participant.email)}</td></tr>
${participant.phone ? `<tr><td style="padding-right:12px;font-weight:600;">Telefon:</td><td>${escapeHtml(participant.phone)}</td></tr>` : ''}
<tr><td style="padding-right:12px;font-weight:600;">Datum:</td><td>${escapeHtml(formatDateShortDE(ev.event_date))}</td></tr>
<tr><td style="padding-right:12px;font-weight:600;">Uhrzeit:</td><td>${escapeHtml(timeRangeText(ev))}</td></tr>
<tr><td style="padding-right:12px;font-weight:600;">Ort:</td><td>${escapeHtml(ev.location)}</td></tr>
<tr><td style="padding-right:12px;font-weight:600;">Plätze:</td><td>${activeCount} / ${ev.max_participants}</td></tr>
</table>`;
  return { subject, html: emailLayout(body) };
}

export function renderWaitlistPromotion(
  ev: EventRow,
  participant: ParticipantRow,
): { subject: string; html: string } {
  const subject = `Ein Platz ist frei – ${ev.title}`;
  const body = `
<h1 style="font-family:Georgia,serif;font-size:22px;color:#2c2418;margin:0 0 16px;">Ein Platz ist frei!</h1>
<p style="font-size:16px;line-height:1.7;color:#5c4a3a;">Hallo ${escapeHtml(participant.first_name)},</p>
<p style="font-size:16px;line-height:1.7;color:#5c4a3a;">gute Nachricht: Bei <strong>${escapeHtml(ev.title)}</strong> ist ein Platz frei geworden und du bist jetzt fest angemeldet!</p>
<table role="presentation" style="margin:24px 0;font-size:15px;color:#5c4a3a;line-height:1.8;">
<tr><td style="padding-right:12px;font-weight:600;">Datum:</td><td>${escapeHtml(formatDateLongDE(ev.event_date))}</td></tr>
<tr><td style="padding-right:12px;font-weight:600;">Uhrzeit:</td><td>${escapeHtml(timeRangeText(ev))}</td></tr>
<tr><td style="padding-right:12px;font-weight:600;">Ort:</td><td>${escapeHtml(ev.location)}${ev.street ? '<br>' + escapeHtml(fullAddress(ev)) : ''}</td></tr>
${ev.location_details ? `<tr><td style="padding-right:12px;font-weight:600;">Hinweis:</td><td>${nl2br(ev.location_details)}</td></tr>` : ''}
${ev.cost_basis ? `<tr><td style="padding-right:12px;font-weight:600;">Kosten:</td><td>${escapeHtml(ev.cost_basis)}</td></tr>` : ''}
</table>
<p style="font-size:15px;line-height:1.7;color:#5c4a3a;"><a href="${escapeHtml(icsUrlFor(ev.slug))}" style="color:#8b5e3c;">📅 Termin zum Kalender hinzufügen</a></p>
<p style="font-size:14px;line-height:1.7;color:#8c7a68;margin-top:24px;">Bei Fragen erreichst du uns unter <a href="mailto:${escapeHtml(config.CONTACT_EMAIL)}" style="color:#8b5e3c;">${escapeHtml(config.CONTACT_EMAIL)}</a>.</p>`;
  return { subject, html: emailLayout(body) };
}

export function renderEventReminder(
  ev: EventRow,
  participant: ParticipantRow,
  isToday: boolean,
): { subject: string; html: string } {
  const whenWord = isToday ? 'heute' : 'morgen';
  const subject = `Erinnerung: ${ev.title} ist ${whenWord}!`;
  const body = `
<h1 style="font-family:Georgia,serif;font-size:22px;color:#2c2418;margin:0 0 16px;">Erinnerung</h1>
<p style="font-size:16px;line-height:1.7;color:#5c4a3a;">Hallo ${escapeHtml(participant.first_name)},</p>
<p style="font-size:16px;line-height:1.7;color:#5c4a3a;">eine kurze Erinnerung: <strong>${escapeHtml(ev.title)}</strong> findet ${whenWord} statt!</p>
<table role="presentation" style="margin:24px 0;font-size:15px;color:#5c4a3a;line-height:1.8;">
<tr><td style="padding-right:12px;font-weight:600;">Datum:</td><td>${escapeHtml(formatDateLongDE(ev.event_date))}</td></tr>
<tr><td style="padding-right:12px;font-weight:600;">Uhrzeit:</td><td>${escapeHtml(timeRangeText(ev))}</td></tr>
<tr><td style="padding-right:12px;font-weight:600;">Ort:</td><td>${escapeHtml(ev.location)}</td></tr>
</table>
<p style="font-size:16px;line-height:1.7;color:#5c4a3a;">Wir freuen uns auf dich ${isToday ? 'gleich' : 'morgen'}!</p>
<p style="font-size:14px;line-height:1.7;color:#8c7a68;margin-top:24px;">Bei Fragen erreichst du uns unter <a href="mailto:${escapeHtml(config.CONTACT_EMAIL)}" style="color:#8b5e3c;">${escapeHtml(config.CONTACT_EMAIL)}</a>.</p>`;
  return { subject, html: emailLayout(body) };
}

export function renderNewsletterWelcome(
  participant: ParticipantRow,
  token: string,
): { subject: string; html: string } {
  const subject =
    'Willkommen beim Männerkreis Niederbayern/ Straubing Newsletter';
  const eventUrl = `${config.APP_URL}/event?utm_source=email&utm_medium=newsletter&utm_campaign=welcome`;
  const unsubUrl = `${config.APP_URL}/newsletter/unsubscribe/${token}?utm_source=email&utm_medium=newsletter&utm_campaign=welcome_unsubscribe`;
  const body = `
<h1 style="font-family:Georgia,serif;font-size:22px;color:#2c2418;margin:0 0 16px;">Willkommen!</h1>
<p style="font-size:16px;line-height:1.7;color:#5c4a3a;">Hallo${participant.first_name ? ' ' + escapeHtml(participant.first_name) : ''},</p>
<p style="font-size:16px;line-height:1.7;color:#5c4a3a;">danke für dein Interesse am Männerkreis! Du erhältst ab jetzt Neuigkeiten zu unseren Treffen und Veranstaltungen.</p>
<p style="font-size:16px;line-height:1.7;color:#5c4a3a;"><a href="${escapeHtml(eventUrl)}" style="color:#8b5e3c;">→ Zum nächsten Termin</a></p>
<p style="font-size:12px;line-height:1.7;color:#8c7a68;margin-top:32px;"><a href="${escapeHtml(unsubUrl)}" style="color:#8c7a68;">Vom Newsletter abmelden</a></p>`;
  return { subject, html: emailLayout(body) };
}

export function renderNewsletterCampaign(
  subjectLine: string,
  processedContent: string,
  token: string,
): { subject: string; html: string } {
  const unsubUrl = `${config.APP_URL}/newsletter/unsubscribe/${token}?utm_source=email&utm_medium=newsletter&utm_campaign=unsubscribe`;
  const body = `
${processedContent}
<p style="font-size:12px;line-height:1.7;color:#8c7a68;margin-top:32px;border-top:1px solid #e8e0d6;padding-top:16px;"><a href="${escapeHtml(unsubUrl)}" style="color:#8c7a68;">Vom Newsletter abmelden</a></p>`;
  return { subject: subjectLine, html: emailLayout(body) };
}
