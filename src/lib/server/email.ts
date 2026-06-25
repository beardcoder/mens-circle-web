import { config } from './config';
import type { Event, Participant } from './db/schema';
import { formatDateLongDE, formatDateShortDE, fullAddress, timeRangeText } from './format';
import { sendTransactional } from './listmonk';

const icsUrlFor = (slug: string): string => `${config.APP_URL}/api/public/events/${slug}/ics`;

const fullName = (p: Participant): string => `${p.firstName || ''} ${p.lastName || ''}`.trim();

const participantCtx = (p: Participant) => ({
  firstName: p.firstName || '',
  recipientEmail: p.email,
  siteName: config.SITE_NAME,
  contactEmail: config.CONTACT_EMAIL,
});

const eventDetail = (ev: Event, opts: { includeAddress?: boolean } = {}) => ({
  dateLong: formatDateLongDE(ev.eventDate),
  dateShort: formatDateShortDE(ev.eventDate),
  timeRange: timeRangeText(ev),
  location: ev.location,
  address: opts.includeAddress ? fullAddress(ev) : '',
  locationDetails: ev.locationDetails,
});

export const sendRegistrationEmails = async (
  ev: Event,
  participant: Participant,
  status: 'registered' | 'waitlist',
  activeCount: number,
): Promise<void> => {
  const recipient = participant.email;
  const recipientName = fullName(participant);
  const ctx = participantCtx(participant);

  const userSend =
    status === 'waitlist'
      ? sendTransactional(config.TX_WAITLIST_CONFIRMATION, recipient, recipientName, {
          subject: `Warteliste: ${ev.title}`,
          ...ctx,
          eventTitle: ev.title,
          ...eventDetail(ev),
        })
      : sendTransactional(config.TX_REGISTRATION_CONFIRMATION, recipient, recipientName, {
          subject: `Anmeldebestätigung: ${ev.title}`,
          ...ctx,
          eventTitle: ev.title,
          ...eventDetail(ev, { includeAddress: true }),
          description: ev.description,
          costBasis: ev.costBasis,
          icsUrl: icsUrlFor(ev.slug),
        });

  const adminSend = sendTransactional(config.TX_ADMIN_NOTIFICATION, config.MAIL_ADMIN_ADDRESS, config.MAIL_ADMIN_NAME, {
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

  await Promise.all([userSend, adminSend]);
};

export const sendWaitlistPromotion = async (ev: Event, participant: Participant): Promise<void> => {
  await sendTransactional(config.TX_WAITLIST_PROMOTION, participant.email, fullName(participant), {
    subject: `Ein Platz ist frei – ${ev.title}`,
    ...participantCtx(participant),
    eventTitle: ev.title,
    ...eventDetail(ev, { includeAddress: true }),
    description: ev.description,
    costBasis: ev.costBasis,
    icsUrl: icsUrlFor(ev.slug),
  });
};

export const sendEventReminder = async (ev: Event, participant: Participant, isToday: boolean): Promise<void> => {
  await sendTransactional(config.TX_EVENT_REMINDER, participant.email, fullName(participant), {
    subject: `Erinnerung: ${ev.title} ist ${isToday ? 'heute' : 'morgen'}!`,
    ...participantCtx(participant),
    eventTitle: ev.title,
    whenWord: isToday ? 'heute' : 'morgen',
    whenWordCap: isToday ? 'Heute' : 'Morgen',
    closingWord: isToday ? 'gleich' : 'morgen',
    ...eventDetail(ev),
    description: ev.description,
    costBasis: ev.costBasis,
  });
};

export const sendEventMessage = async (
  ev: Event,
  participant: Participant,
  subject: string,
  content: string,
): Promise<boolean> => {
  const personalised = content.replace(/\{first_name\}/g, participant.firstName || '');
  return sendTransactional(config.TX_EVENT_MESSAGE, participant.email, fullName(participant), {
    subject,
    content: personalised,
    eventTitle: ev.title,
    siteName: config.SITE_NAME,
    recipientEmail: participant.email,
  });
};
