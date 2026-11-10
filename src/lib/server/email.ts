import site from '../../data/site.json';
import { fullAddress } from '../shared/format';
import { formatDateLong, formatDateShort, formatTimeRange } from '../shared/time';
import { cancelUrlFor } from './cancel-token';
import { config } from './config';
import type { Event, Participant } from './db/schema';
import { sendTransactional } from './listmonk';

const icsUrlFor = (slug: string): string => `${config.APP_URL}/api/public/events/${slug}/ics`;
const eventUrlFor = (slug: string): string => `${config.APP_URL}/event/${slug}`;

const fullName = (p: Participant): string => `${p.firstName || ''} ${p.lastName || ''}`.trim();

const participantCtx = (p: Participant) => ({
  firstName: p.firstName || '',
  recipientEmail: p.email,
  siteName: site.siteName,
  contactEmail: config.CONTACT_EMAIL,
});

/** "Donnerstag," and "26. November 2026": the templates keep each on one line, so a narrow mail breaks after the weekday. */
const dateParts = (eventDate: string): { dateWeekday: string; dateDay: string } => {
  const [weekday, ...rest] = formatDateLong(eventDate).split(', ');

  return rest.length ? { dateWeekday: `${weekday},`, dateDay: rest.join(', ') } : { dateWeekday: '', dateDay: '' };
};

const eventDetail = (ev: Event, opts: { includeAddress?: boolean } = {}) => ({
  eventUrl: eventUrlFor(ev.slug),
  dateLong: formatDateLong(ev.eventDate),
  ...dateParts(ev.eventDate),
  dateShort: formatDateShort(ev.eventDate),
  timeRange: formatTimeRange(ev.startTime, ev.endTime),
  location: ev.location,
  address: opts.includeAddress ? fullAddress(ev) : '',
  locationDetails: ev.locationDetails,
});

/** The whole event, for the mails that carry everything a participant needs to come. */
const fullDetail = (ev: Event) => ({
  eventTitle: ev.title,
  ...eventDetail(ev, { includeAddress: true }),
  description: ev.description,
  costBasis: ev.costBasis,
});

/** The participant's own confirmation. */
export const sendRegistrationConfirmation = async (
  ev: Event,
  participant: Participant,
  status: 'registered' | 'waitlist',
  registrationId: string,
): Promise<boolean> => {
  const recipient = participant.email;
  const recipientName = fullName(participant);
  const ctx = { ...participantCtx(participant), cancelUrl: await cancelUrlFor(registrationId, ev.eventDate) };

  return status === 'waitlist'
    ? sendTransactional(config.TX_WAITLIST_CONFIRMATION, recipient, recipientName, {
        subject: `Warteliste: ${ev.title}`,
        ...ctx,
        eventTitle: ev.title,
        ...eventDetail(ev),
      })
    : sendTransactional(config.TX_REGISTRATION_CONFIRMATION, recipient, recipientName, {
        subject: `Anmeldebestätigung: ${ev.title}`,
        ...ctx,
        ...fullDetail(ev),
        icsUrl: icsUrlFor(ev.slug),
      });
};

/** Both mails one registration triggers; resolves to whether the participant's copy went out. */
export const sendRegistrationEmails = async (
  ev: Event,
  participant: Participant,
  status: 'registered' | 'waitlist',
  activeCount: number,
  registrationId: string,
): Promise<boolean> => {
  const userSend = sendRegistrationConfirmation(ev, participant, status, registrationId);

  const adminSend = sendTransactional(config.TX_ADMIN_NOTIFICATION, config.MAIL_ADMIN_ADDRESS, config.MAIL_ADMIN_NAME, {
    subject: `Neue Anmeldung: ${ev.title}`,
    eventTitle: ev.title,
    participantName: fullName(participant),
    participantEmail: participant.email,
    participantPhone: participant.phone,
    dateShort: formatDateShort(ev.eventDate),
    timeRange: formatTimeRange(ev.startTime, ev.endTime),
    location: ev.location,
    activeCount,
    maxParticipants: ev.maxParticipants,
    statusLabel: status === 'waitlist' ? 'Warteliste' : 'Angemeldet',
    adminUrl: `${config.APP_URL}/admin/events/${ev.id}`,
  });

  const [userSent] = await Promise.all([userSend, adminSend]);

  return userSent;
};

export const sendWaitlistPromotion = async (
  ev: Event,
  participant: Participant,
  registrationId: string,
): Promise<void> => {
  await sendTransactional(config.TX_WAITLIST_PROMOTION, participant.email, fullName(participant), {
    subject: `Ein Platz ist frei – ${ev.title}`,
    ...participantCtx(participant),
    cancelUrl: await cancelUrlFor(registrationId, ev.eventDate),
    ...fullDetail(ev),
    icsUrl: icsUrlFor(ev.slug),
  });
};

export const sendEventReminder = async (
  ev: Event,
  participant: Participant,
  isToday: boolean,
  registrationId: string,
): Promise<boolean> => {
  return sendTransactional(config.TX_EVENT_REMINDER, participant.email, fullName(participant), {
    subject: `Erinnerung: ${ev.title} ist ${isToday ? 'heute' : 'morgen'}!`,
    ...participantCtx(participant),
    cancelUrl: await cancelUrlFor(registrationId, ev.eventDate),
    ...fullDetail(ev),
    whenWord: isToday ? 'heute' : 'morgen',
    whenWordCap: isToday ? 'Heute' : 'Morgen',
    closingWord: isToday ? 'gleich' : 'morgen',
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
    ...participantCtx(participant),
    content: personalised,
    eventTitle: ev.title,
    dateLong: formatDateLong(ev.eventDate),
    timeRange: formatTimeRange(ev.startTime, ev.endTime),
  });
};
