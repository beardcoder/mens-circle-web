/**
 * Email renderers — each returns `{ subject, html }`. Ported from the former Go
 * `html/template` files under `pb_hooks/views/emails/*.html`, kept byte-faithful
 * (same copy, same inline styles, same German "du"-form). Scalar values are
 * HTML-escaped; trusted-HTML fields (description / location details / admin
 * content) are passed through `nl2br` and inlined raw, exactly as before.
 */
import { config } from '../config';
import type { EventRow } from '../db/schema';
import {
  escapeHtml,
  formatDateLongDE,
  formatDateShortDE,
  fullAddress,
  nl2br,
  timeRangeText,
} from '../format';

export interface Rendered {
  subject: string;
  html: string;
}

export interface MailParticipant {
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
}

const e = escapeHtml;

function icsUrlFor(slug: string): string {
  return `${config.APP_URL}/api/public/events/${slug}/ics`;
}

function layout(body: string): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background-color:#efe9dd;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#efe9dd;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:40px 40px 32px;font-family:'DM Sans',Helvetica,Arial,sans-serif;color:#2c2418;">
              ${body}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const LBL =
  "padding:6px 0;vertical-align:top;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;color:#7a6248;text-transform:uppercase;letter-spacing:0.08em;";
const VAL =
  "padding:6px 0;font-family:'DM Sans',sans-serif;font-size:15px;color:#2c2418;";

/** A "label / value" row; `value` is already-safe HTML. Empty → omitted. */
function row(label: string, value: string): string {
  if (!value) return '';
  return `<tr><td width="90" style="${LBL}">${label}</td><td style="${VAL}">${value}</td></tr>`;
}

const RULE_THICK =
  '<tr><td style="height:2px;background-color:#c4b49a;font-size:0;line-height:0;">&nbsp;</td></tr>';
const RULE_THIN =
  '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:32px 0;"><tr><td style="height:1px;background-color:#c4b49a;font-size:0;line-height:0;">&nbsp;</td></tr></table>';

function detailBlock(heading: string, rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;">
  ${RULE_THICK}
  <tr><td style="background-color:#f4f0e8;padding:28px;">
    <p style="margin:0 0 20px;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;color:#b86f52;text-transform:uppercase;letter-spacing:0.15em;">${heading}</p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows}</table>
  </td></tr>
</table>`;
}

function eventRows(
  ev: EventRow,
  opts: { includeAddress: boolean; hintLabel?: string },
): string {
  return (
    row('Datum', e(formatDateLongDE(ev.eventDate))) +
    row('Uhrzeit', e(timeRangeText(ev.startTime, ev.endTime))) +
    row('Ort', e(ev.location)) +
    (opts.includeAddress ? row('Adresse', e(fullAddress(ev))) : '') +
    row(
      opts.hintLabel ?? 'Hinweis',
      ev.locationDetails ? nl2br(ev.locationDetails) : '',
    )
  );
}

const eyebrow = (text: string) =>
  `<p style="text-align:center;margin:0 0 6px;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;color:#b86f52;text-transform:uppercase;letter-spacing:0.2em;">${text}</p>`;
const h1 = (text: string) =>
  `<h1 style="text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.3;color:#2c2418;margin:0 0 16px;">${text}</h1>`;
const h2 = (text: string) =>
  `<h2 style="font-family:Georgia,'Times New Roman',serif;font-size:19px;color:#2c2418;margin:32px 0 12px;">${text}</h2>`;
const para = (html: string) =>
  `<p style="font-size:15px;line-height:1.7;color:#3a342c;margin:0 0 16px;">${html}</p>`;

function icsButton(slug: string): string {
  const url = icsUrlFor(slug);
  return `${para('Damit der Termin direkt in deinem Kalender landet, lade dir die Termin-Datei (.ics) herunter:')}
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;">
  <tr><td align="center">
    <a href="${url}" style="display:inline-block;background-color:#b86f52;color:#ffffff;text-decoration:none;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;padding:14px 28px;border-radius:6px;">📅 Zum Kalender hinzufügen (.ics)</a>
  </td></tr>
</table>`;
}

function signature(): string {
  return `${para(`Herzliche Grüße,<br /><strong>${e(config.SITE_NAME)}</strong>`)}`;
}

function footer(text: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;">
  <tr><td style="border-top:1px solid #e3dccb;padding-top:16px;font-family:'DM Sans',sans-serif;font-size:12px;line-height:1.6;color:#8a7c66;">${text}</td></tr>
</table>`;
}

const goodToKnow = `${h2('Gut zu wissen')}
<ul style="font-size:15px;line-height:1.7;color:#3a342c;margin:0 0 16px;padding-left:20px;">
  <li>Komm pünktlich – wir starten gemeinsam</li>
  <li>Bring eine offene Haltung und Bereitschaft für echte Begegnung mit</li>
  <li>Bei Fragen oder falls du doch nicht teilnehmen kannst, schreib uns an <a href="mailto:${e(config.CONTACT_EMAIL)}" style="color:#b86f52;">${e(config.CONTACT_EMAIL)}</a></li>
</ul>`;

// ── (1) Registration confirmation ──────────────────────────────────────────
export function renderRegistrationConfirmation(
  ev: EventRow,
  p: MailParticipant,
): Rendered {
  const firstName = e(p.firstName || '');
  const body = `${eyebrow('Anmeldungsbestätigung')}
${h1(`Hallo ${firstName}, du bist dabei!`)}
<p style="text-align:center;color:#5c4a3a;font-size:15px;line-height:1.6;margin:0 0 32px;">Dein Platz beim <strong>${e(ev.title)}</strong> ist reserviert.<br />Wir freuen uns sehr, dich dabei zu haben.</p>
${detailBlock('Dein Termin', eventRows(ev, { includeAddress: true }))}
${icsButton(ev.slug)}
${h2('Was dich erwartet')}
${para(nl2br(ev.description))}
${para(`<strong>Teilnahme:</strong> ${e(ev.costBasis)}`)}
${goodToKnow}
${RULE_THIN}
${para('Wir freuen uns auf dich.')}
${signature()}
${footer(`Diese E-Mail wurde an ${e(p.email)} gesendet, weil du dich für unsere Veranstaltung angemeldet hast.`)}`;
  return { subject: `Anmeldebestätigung: ${ev.title}`, html: layout(body) };
}

// ── (3) Waitlist confirmation ───────────────────────────────────────────────
export function renderWaitlistConfirmation(
  ev: EventRow,
  p: MailParticipant,
): Rendered {
  const firstName = e(p.firstName || '');
  const body = `${eyebrow('Warteliste')}
${h1('Du bist auf der Warteliste!')}
<p style="text-align:center;color:#5c4a3a;font-size:15px;line-height:1.6;margin:0 0 32px;">Hallo ${firstName}, du bist auf der Warteliste für <strong>${e(ev.title)}</strong>.<br />Wir benachrichtigen dich sofort, wenn ein Platz frei wird.</p>
${detailBlock('Veranstaltung', eventRows(ev, { includeAddress: false }))}
${h2('Was jetzt?')}
${para(`Wir informieren dich automatisch per E-Mail, sobald ein Platz frei wird. Du musst nichts weiter tun. Solltest du doch nicht mehr teilnehmen können, schreib uns kurz an <a href="mailto:${e(config.CONTACT_EMAIL)}" style="color:#b86f52;">${e(config.CONTACT_EMAIL)}</a>, damit wir deinen Platz weitergeben können.`)}
${RULE_THIN}
${para('Wir freuen uns, dich vielleicht bald begrüßen zu dürfen.')}
${signature()}
${footer(`Diese E-Mail wurde an ${e(p.email)} gesendet, weil du dich auf die Warteliste für unsere Veranstaltung eingetragen hast.`)}`;
  return { subject: `Warteliste: ${ev.title}`, html: layout(body) };
}

// ── (2) Admin new-registration notification ─────────────────────────────────
export function renderAdminNotification(
  ev: EventRow,
  p: MailParticipant,
  activeCount: number,
): Rendered {
  const name = `${p.firstName || ''} ${p.lastName || ''}`.trim();
  const participantRows =
    row('Name', e(name)) +
    row('E-Mail', e(p.email)) +
    row('Telefon', e(p.phone));
  const eventInfoRows =
    row('Datum', e(formatDateShortDE(ev.eventDate))) +
    row('Uhrzeit', e(timeRangeText(ev.startTime, ev.endTime))) +
    row('Ort', e(ev.location || '')) +
    row('Plätze', `<strong>${activeCount} / ${ev.maxParticipants}</strong>`);
  const body = `${eyebrow('Neue Anmeldung')}
${h1(e(ev.title))}
${detailBlock('Teilnehmer', participantRows)}
${detailBlock('Veranstaltung', eventInfoRows)}
${footer('Diese E-Mail wurde automatisch versendet.')}`;
  return { subject: `Neue Anmeldung: ${ev.title}`, html: layout(body) };
}

// ── (4) Waitlist promotion ──────────────────────────────────────────────────
export function renderWaitlistPromotion(
  ev: EventRow,
  p: MailParticipant,
): Rendered {
  const firstName = e(p.firstName || '');
  const body = `${eyebrow('Gute Neuigkeit')}
${h1('Ein Platz ist frei!')}
<p style="text-align:center;color:#5c4a3a;font-size:15px;line-height:1.6;margin:0 0 32px;">Hallo ${firstName}, du rückst von der Warteliste auf!<br />Dein Platz beim <strong>${e(ev.title)}</strong> ist jetzt reserviert.</p>
${detailBlock('Dein Termin', eventRows(ev, { includeAddress: true }))}
${icsButton(ev.slug)}
${h2('Was dich erwartet')}
${para(nl2br(ev.description))}
${para(`<strong>Teilnahme:</strong> ${e(ev.costBasis)}`)}
${goodToKnow}
${RULE_THIN}
${para('Wir freuen uns auf dich!')}
${signature()}
${footer(`Diese E-Mail wurde an ${e(p.email)} gesendet, weil du von der Warteliste für unsere Veranstaltung aufgerückt bist.`)}`;
  return { subject: `Ein Platz ist frei – ${ev.title}`, html: layout(body) };
}

// ── (5) Event reminder ──────────────────────────────────────────────────────
export function renderEventReminder(
  ev: EventRow,
  p: MailParticipant,
  isToday: boolean,
): Rendered {
  const firstName = e(p.firstName || '');
  const whenWord = isToday ? 'heute' : 'morgen';
  const whenWordCap = isToday ? 'Heute' : 'Morgen';
  const closingWord = isToday ? 'gleich' : 'morgen';
  const body = `${eyebrow('Erinnerung')}
${h1(`${whenWordCap} ist es soweit!`)}
<p style="text-align:center;color:#5c4a3a;font-size:15px;line-height:1.6;margin:0 0 32px;">Hallo ${firstName}, dein Termin<br /><strong>${e(ev.title)}</strong> findet ${whenWord} statt.</p>
${detailBlock('Dein Termin', eventRows(ev, { includeAddress: false, hintLabel: 'Treffpunkt' }))}
${h2('Zur Erinnerung')}
${para(nl2br(ev.description))}
${para(`<strong>Teilnahme:</strong> ${e(ev.costBasis)}`)}
${h2('Bitte beachten')}
<ul style="font-size:15px;line-height:1.7;color:#3a342c;margin:0 0 16px;padding-left:20px;">
  <li>Komm pünktlich – wir starten gemeinsam</li>
  <li>Bring eine offene Haltung und Bereitschaft für echte Begegnung mit</li>
  <li>Kurzfristig verhindert? Schreib uns bitte an <a href="mailto:${e(config.CONTACT_EMAIL)}" style="color:#b86f52;">${e(config.CONTACT_EMAIL)}</a></li>
</ul>
${RULE_THIN}
${para(`Bis ${closingWord}!`)}
${signature()}
${footer(`Diese Erinnerung wurde an ${e(p.email)} gesendet, weil du für diese Veranstaltung angemeldet bist.`)}`;
  return {
    subject: `Erinnerung: ${ev.title} ist ${whenWord}!`,
    html: layout(body),
  };
}

// ── (6) Event participant message (admin-authored, content already substituted)
export function renderEventParticipantMessage(
  subjectLine: string,
  contentHtml: string,
  ev: EventRow,
): Rendered {
  const body = `<div style="font-size:15px;line-height:1.7;color:#3a342c;">${contentHtml}</div>
${RULE_THIN}
${signature()}
${footer(`Diese E-Mail wurde gesendet, weil du für die Veranstaltung „${e(ev.title)}“ angemeldet bist.`)}`;
  return { subject: subjectLine, html: layout(body) };
}
