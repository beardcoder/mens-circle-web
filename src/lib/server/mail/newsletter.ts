/** The body of the event newsletter campaign; the listmonk campaign template wraps it. */
import { BRAND, MAIL_FONTS } from '../../shared/brand';
import { fullAddress } from '../../shared/format';
import { escapeHtml } from '../../shared/html';
import { formatDateLong, formatTimeRange } from '../../shared/time';
import { config } from '../config';
import type { Event } from '../db/schema';

// Opens after the campaign template's "Hallo,": hence the lower case.
export const DEFAULT_EVENT_NEWSLETTER_INTRO = `der nächste Männerkreis steht fest. Wir sitzen im Kreis, hören einander zu und sprechen über das, was uns gerade beschäftigt. Niemand bewertet, und Ratschläge gibt es nur, wenn jemand darum bittet.

Vorbereiten musst du nichts. Je nach Abend kommen einfache Übungen mit Atem und Körperwahrnehmung dazu; du machst mit, soweit es für dich passt.

Die Runde bleibt klein. Wenn du dabei sein möchtest, melde dich auf der Seite des Termins an. Ich freue mich auf dich.`;

const introToProse = (text: string): string =>
  text
    .trim()
    .split(/\n\s*\n/)
    .map((para) => `<p>${escapeHtml(para.trim()).replace(/\r?\n/g, '<br />')}</p>`)
    .join('\n');

// The campaign template's palette and type; inline, so the block holds in any template.
const NL = {
  text: BRAND.ink,
  muted: BRAND.muted,
  lineStrong: BRAND.lineStrong,
  sand: BRAND.sand,
  fill: BRAND.ember,
  onFill: BRAND.onEmber,
  ...MAIL_FONTS,
};

/** "Donnerstag," and "26. November 2026", each kept on one line: a narrow mail breaks after the weekday. */
const dateLines = (dateLong: string): string =>
  dateLong
    .split(', ')
    .map(
      (part, i, all) => `<span style="white-space:nowrap;">${escapeHtml(part)}${i < all.length - 1 ? ',' : ''}</span>`,
    )
    .join(' ');

const newsletterRow = ([label, value]: [string, string]): string =>
  `<tr><td width="88" style="width:88px;padding:4px 12px 4px 0;vertical-align:top;font-family:${NL.sans};font-size:14px;line-height:24px;color:${NL.muted};">${label}</td>` +
  `<td style="padding:4px 0;vertical-align:top;font-family:${NL.sans};font-size:16px;line-height:24px;color:${NL.text};">${escapeHtml(value)}</td></tr>`;

/**
 * The event as the site's date summary sets it: a rounded sand card with the
 * label, the date, the title, the facts as rows and the one round action.
 */
export const buildEventNewsletterHtml = (ev: Event, intro: string): string => {
  const url = `${config.APP_URL}/event/${ev.slug}`;
  const dateLong = formatDateLong(ev.eventDate);
  const body = intro.trim() ? intro : DEFAULT_EVENT_NEWSLETTER_INTRO;

  const rows = (
    [
      ['Zeit', formatTimeRange(ev.startTime, ev.endTime)],
      ['Ort', ev.location],
      ['Adresse', fullAddress(ev)],
      ['Beitrag', ev.costBasis],
    ] satisfies [string, string][]
  ).filter(([, value]) => value);

  const event = [
    `<div class="em-event" style="margin:10px 0 30px;padding:26px 28px 24px;background-color:${NL.sand};border-radius:20px;">`,
    `<p style="margin:0 0 10px;font-family:${NL.sans};font-size:14px;font-weight:600;line-height:1.3;color:${NL.muted};">Nächster Termin</p>`,
    dateLong
      ? `<p class="em-event__date" style="margin:0;font-family:${NL.serif};font-size:26px;font-weight:500;line-height:1.25;color:${NL.text};">${dateLines(dateLong)}</p>`
      : '',
    `<h2 style="margin:4px 0 0;font-family:${NL.sans};font-size:16px;font-weight:600;line-height:1.5;letter-spacing:0;color:${NL.text};">${escapeHtml(ev.title)}</h2>`,
    rows.length
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-top:1px solid ${NL.lineStrong};"><tr><td style="padding-top:12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.map(newsletterRow).join('')}</table></td></tr></table>`
      : '',
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;"><tr><td style="background-color:${NL.fill};border-radius:999px;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 26px;font-family:${NL.sans};font-size:16px;font-weight:600;line-height:1.1;color:${NL.onFill};text-decoration:none;border-radius:999px;">Zur Anmeldung&nbsp;&nbsp;&rarr;</a></td></tr></table>`,
    '</div>',
  ]
    .filter(Boolean)
    .join('\n');

  return [introToProse(body), event].join('\n');
};
