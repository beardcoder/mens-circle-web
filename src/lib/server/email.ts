/**
 * Transactional email orchestration (server-only).
 *
 * Builds the data payloads for the listmonk transactional templates and sends
 * them via `sendTransactional`. The template markup + subject live in listmonk
 * (referenced by the IDs in `config.TX_*`); this module owns the *data* and the
 * German subject-line interpolation only.
 *
 * Mirrors the six emails of the former PocketBase setup:
 *   1 registration confirmation   2 admin notification   3 waitlist confirmation
 *   4 waitlist promotion          5 event reminder        6 event participant message
 */
import { config } from './config';
import type { Event, Participant } from './db/schema';
import { formatDateLongDE, formatDateShortDE, fullAddress, timeRangeText } from './format';
import { sendTransactional } from './listmonk';

function icsUrlFor(slug: string): string {
  return `${config.APP_URL}/api/public/events/${slug}/ics`;
}

/** Shared event detail fields consumed by most templates. */
function eventDetail(ev: Event, opts: { includeAddress?: boolean } = {}) {
  return {
    dateLong: formatDateLongDE(ev.eventDate),
    dateShort: formatDateShortDE(ev.eventDate),
    timeRange: timeRangeText(ev),
    location: ev.location,
    address: opts.includeAddress ? fullAddress(ev) : '',
    locationDetails: ev.locationDetails,
  };
}

function fullName(p: Participant): string {
  return `${p.firstName || ''} ${p.lastName || ''}`.trim();
}

/** Participant confirmation (registered) or waitlist email, + admin notification. */
export async function sendRegistrationEmails(
  ev: Event,
  participant: Participant,
  status: 'registered' | 'waitlist',
  activeCount: number,
): Promise<void> {
  const recipient = participant.email;
  const recipientName = fullName(participant);
  const firstName = participant.firstName || '';

  if (status === 'waitlist') {
    await sendTransactional(config.TX_WAITLIST_CONFIRMATION, recipient, recipientName, {
      subject: `Warteliste: ${ev.title}`,
      firstName,
      eventTitle: ev.title,
      ...eventDetail(ev, { includeAddress: false }),
      contactEmail: config.CONTACT_EMAIL,
      siteName: config.SITE_NAME,
      recipientEmail: recipient,
    });
  } else {
    await sendTransactional(config.TX_REGISTRATION_CONFIRMATION, recipient, recipientName, {
      subject: `Anmeldebestätigung: ${ev.title}`,
      firstName,
      eventTitle: ev.title,
      ...eventDetail(ev, { includeAddress: true }),
      description: ev.description,
      costBasis: ev.costBasis,
      contactEmail: config.CONTACT_EMAIL,
      siteName: config.SITE_NAME,
      recipientEmail: recipient,
      icsUrl: icsUrlFor(ev.slug),
    });
  }

  // Admin notification (always).
  await sendTransactional(config.TX_ADMIN_NOTIFICATION, config.MAIL_ADMIN_ADDRESS, config.MAIL_ADMIN_NAME, {
    subject: `Neue Anmeldung: ${ev.title}`,
    eventTitle: ev.title,
    participantName: recipientName,
    participantEmail: recipient,
    participantPhone: participant.phone,
    dateShort: formatDateShortDE(ev.eventDate),
    timeRange: timeRangeText(ev),
    location: ev.location,
    activeCount,
    maxParticipants: ev.maxParticipants,
    statusLabel: status === 'waitlist' ? 'Warteliste' : 'Angemeldet',
  });
}

/** Waitlist promotion email (a spot opened up). */
export async function sendWaitlistPromotion(ev: Event, participant: Participant): Promise<void> {
  await sendTransactional(config.TX_WAITLIST_PROMOTION, participant.email, fullName(participant), {
    subject: `Ein Platz ist frei – ${ev.title}`,
    firstName: participant.firstName || '',
    eventTitle: ev.title,
    ...eventDetail(ev, { includeAddress: true }),
    description: ev.description,
    costBasis: ev.costBasis,
    contactEmail: config.CONTACT_EMAIL,
    siteName: config.SITE_NAME,
    recipientEmail: participant.email,
    icsUrl: icsUrlFor(ev.slug),
  });
}

/** Event reminder (heute / morgen). */
export async function sendEventReminder(ev: Event, participant: Participant, isToday: boolean): Promise<void> {
  await sendTransactional(config.TX_EVENT_REMINDER, participant.email, fullName(participant), {
    subject: `Erinnerung: ${ev.title} ist ${isToday ? 'heute' : 'morgen'}!`,
    firstName: participant.firstName || '',
    eventTitle: ev.title,
    whenWord: isToday ? 'heute' : 'morgen',
    whenWordCap: isToday ? 'Heute' : 'Morgen',
    closingWord: isToday ? 'gleich' : 'morgen',
    ...eventDetail(ev, { includeAddress: false }),
    description: ev.description,
    costBasis: ev.costBasis,
    contactEmail: config.CONTACT_EMAIL,
    siteName: config.SITE_NAME,
    recipientEmail: participant.email,
  });
}

/** Free-form message from the admin to a single event participant. */
export async function sendEventMessage(
  ev: Event,
  participant: Participant,
  subject: string,
  content: string,
): Promise<boolean> {
  // {first_name} placeholder support, mirroring the old admin broadcast.
  const personalised = content.replace(/\{first_name\}/g, participant.firstName || '');
  return sendTransactional(config.TX_EVENT_MESSAGE, participant.email, fullName(participant), {
    subject,
    content: personalised,
    eventTitle: ev.title,
    siteName: config.SITE_NAME,
    recipientEmail: participant.email,
  });
}
