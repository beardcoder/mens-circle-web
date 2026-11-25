/**
 * The participant and admin mails as finished messages, sent through EmDash's email
 * pipeline (`ctx.email.send`, SMTP under Settings → Email). The HTML comes from the
 * designed templates beside this file; the text part says the same in a few lines.
 */
import site from '../../../data/site.json'
import type { EventRecord } from '../../shared/event-entry'
import { fullAddress } from '../../shared/format'
import { formatDateLong, formatDateShort, formatTimeRange } from '../../shared/time'
import { config } from '../config'
import { adminNotificationHtml } from './admin-notification'
import { eventReminderHtml } from './event-reminder'
import { registrationConfirmationHtml } from './registration-confirmation'

export interface Message {
  to: string
  subject: string
  text: string
  html: string
}

/** The person behind a registration, as the mails address them. */
export interface Participant {
  firstName: string
  lastName: string
  email: string
  phone: string
}

const eventUrl = (ev: EventRecord): string => `${config.APP_URL}/event/${ev.slug}`

/** "Donnerstag," and "26. November 2026": the templates keep each on one line, so a narrow mail breaks after the weekday. */
const dateParts = (day: string): { dateWeekday: string, dateDay: string } => {
  const [weekday, ...rest] = formatDateLong(day).split(', ')

  return rest.length ? { dateWeekday: `${weekday},`, dateDay: rest.join(', ') } : { dateWeekday: '', dateDay: '' }
}

/** Everything a participant needs to come. */
const eventDetail = (ev: EventRecord) => ({
  eventTitle: ev.title,
  eventUrl: eventUrl(ev),
  dateLong: formatDateLong(ev.event_date),
  ...dateParts(ev.event_date),
  timeRange: formatTimeRange(ev.start_time, ev.end_time),
  location: ev.location,
  address: fullAddress({ street: ev.street, postalCode: ev.postal_code, city: ev.city }),
  locationDetails: ev.location_details,
  costBasis: ev.cost_basis,
})

const lines = (...parts: Array<string | false>): string => parts.filter(part => part !== false).join('\n')

const textDetail = (ev: EventRecord): string => {
  const d = eventDetail(ev)

  return lines(
    `${d.eventTitle}: ${d.dateLong}${d.timeRange ? `, ${d.timeRange}` : ''}`,
    !!d.location && `Ort: ${d.location}`,
    !!d.address && `Adresse: ${d.address}`,
    !!d.locationDetails && `Treffpunkt: ${d.locationDetails}`,
    !!d.costBasis && `Beitrag: ${d.costBasis}`,
    `Alle Infos: ${d.eventUrl}`,
  )
}

const cancelLine = (cancelUrl: string): string =>
  cancelUrl
    ? `Falls dir etwas dazwischenkommt, sag hier ab: ${cancelUrl}`
    : `Falls dir etwas dazwischenkommt, schreib mir an ${config.CONTACT_EMAIL}.`

/** The participant's confirmation, with the calendar link and their cancel link. */
export const registrationConfirmation = (ev: EventRecord, p: Participant, cancelUrl: string): Message => {
  const subject = `Anmeldebestätigung: ${ev.title}`

  return {
    to: p.email,
    subject,
    html: registrationConfirmationHtml({
      subject,
      firstName: p.firstName,
      recipientEmail: p.email,
      contactEmail: config.CONTACT_EMAIL,
      cancelUrl,
      icsUrl: `${config.APP_URL}/api/public/events/${ev.slug}/ics`,
      description: ev.description,
      ...eventDetail(ev),
    }),
    text: lines(
      `Hallo ${p.firstName}, dein Platz ist reserviert. Schön, dass du kommst.`,
      '',
      textDetail(ev),
      '',
      cancelLine(cancelUrl),
      '',
      'Bis bald und herzliche Grüße',
      'Markus',
      site.siteName,
    ),
  }
}

/** The reminder the evening before ("morgen") or on the day ("heute"). */
export const eventReminder = (ev: EventRecord, p: Participant, isToday: boolean, cancelUrl: string): Message => {
  const whenWord = isToday ? 'heute' : 'morgen'
  const subject = `Erinnerung: ${ev.title} ist ${whenWord}!`

  return {
    to: p.email,
    subject,
    html: eventReminderHtml({
      subject,
      firstName: p.firstName,
      recipientEmail: p.email,
      contactEmail: config.CONTACT_EMAIL,
      cancelUrl,
      whenWord,
      whenWordCap: isToday ? 'Heute' : 'Morgen',
      closingWord: isToday ? 'gleich' : 'morgen',
      ...eventDetail(ev),
    }),
    text: lines(
      `Hallo ${p.firstName}, ${whenWord} ist es so weit.`,
      '',
      textDetail(ev),
      '',
      cancelLine(cancelUrl),
      '',
      `Bis ${isToday ? 'gleich' : 'morgen'}`,
      'Markus',
    ),
  }
}

/** The admin's note of a new registration. */
export const adminNotification = (ev: EventRecord, p: Participant, taken: number, registrationId: string): Message => {
  const subject = `Neue Anmeldung: ${ev.title}`
  const participantName = `${p.firstName} ${p.lastName}`.trim()
  const adminUrl = `${config.APP_URL}/_emdash/admin/content/registrations/${registrationId}`

  return {
    to: config.MAIL_ADMIN_ADDRESS,
    subject,
    html: adminNotificationHtml({
      subject,
      eventTitle: ev.title,
      participantName,
      participantEmail: p.email,
      participantPhone: p.phone,
      dateShort: formatDateShort(ev.event_date),
      timeRange: formatTimeRange(ev.start_time, ev.end_time),
      location: ev.location,
      activeCount: taken,
      maxParticipants: ev.max_participants,
      statusLabel: 'Angemeldet',
      adminUrl,
    }),
    text: lines(
      `${participantName} <${p.email}>${p.phone ? `, ${p.phone}` : ''}`,
      `hat sich angemeldet für ${ev.title} am ${formatDateShort(ev.event_date)}.`,
      `Belegt: ${taken} von ${ev.max_participants}`,
      adminUrl,
    ),
  }
}
