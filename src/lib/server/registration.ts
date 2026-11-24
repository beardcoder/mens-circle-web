/**
 * A public sign-up: checks the event, refuses a second seat for the same address and
 * a seat beyond the limit (no waiting list: full is full), stores the registration
 * as a published `registrations` entry and sends the two mails.
 */
import { PluginRouteError } from 'emdash';

import { cancelUrlFor } from './cancel-token';
import { adminNotification, registrationConfirmation } from './mail';
import { activeRegistrations, deliver, eventOf, type Store } from './registration-tasks';

export interface RegistrationInput {
  event_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
}

const refuse = (status: number, message: string): never => {
  throw new PluginRouteError(status === 404 ? 'NOT_FOUND' : 'CONFLICT', message, status);
};

export const confirmationMessage = (firstName: string): string =>
  `Vielen Dank, ${firstName}! Deine Anmeldung war erfolgreich. Du erhältst in Kürze eine Bestätigung per E-Mail.`;

/**
 * shortcut: the seat check and the insert are two steps, so two sign-ups in the same
 * instant can take one seat too many; upgrade to a per-event counter (`updateIf`)
 * if that ever happens at this size.
 */
export async function register(store: Store, input: RegistrationInput): Promise<{ message: string }> {
  const item = await store.content.get('events', input.event_id);

  if (!item || item.status !== 'published') return refuse(404, 'Diese Veranstaltung ist nicht verfügbar.');

  const seats = await activeRegistrations(store, item.id);
  const event = eventOf(item, seats.length);
  const email = input.email.trim().toLowerCase();

  if (event.is_past)
    return refuse(410, 'Diese Veranstaltung hat bereits stattgefunden. Eine Anmeldung ist nicht mehr möglich.');

  if (seats.some((seat) => String(seat.data.email).toLowerCase() === email)) {
    return refuse(409, 'Du bist bereits für diese Veranstaltung angemeldet.');
  }

  if (event.is_full) return refuse(409, 'Dieser Termin ist leider schon voll.');

  const participant = {
    firstName: input.first_name.trim(),
    lastName: input.last_name.trim(),
    email,
    phone: input.phone?.trim() ?? '',
  };

  const created = await store.content.create('registrations', {
    first_name: participant.firstName,
    last_name: participant.lastName,
    email,
    phone: participant.phone,
    event: item.id,
  });

  const versioned = await store.content.getVersioned('registrations', created.id);

  // Published, so the seat counts on the public pages (they read published entries) include it.
  if (versioned) await store.content.publish('registrations', created.id, { _rev: versioned._rev });

  // The seat is taken; a mail that fails is logged, never turned into a failed sign-up.
  const cancelUrl = await cancelUrlFor(created.id, event.event_date);

  await Promise.all([
    deliver(store, registrationConfirmation(event, participant, cancelUrl)),
    deliver(store, adminNotification(event, participant, seats.length + 1, created.id)),
  ]);

  return { message: confirmationMessage(participant.firstName) };
}
