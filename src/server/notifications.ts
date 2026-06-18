/**
 * Domain events → side effects. The capacity/registration logic stays pure and
 * just *emits* what happened; the email sending lives in handlers registered
 * here. This is the explicit "email events" model: adding a new reaction (an
 * SMS, a Slack ping, an analytics pixel) means adding a handler, never touching
 * the services.
 *
 * Mirrors the former PocketBase `onRecordAfterCreateSuccess` / cron email
 * orchestration, but as in-process events instead of record hooks.
 */

import { config } from './config';
import type { EventRow, RegistrationStatus } from './db/schema';
import type { MailParticipant, Rendered } from './mail/templates';
import {
  renderAdminNotification,
  renderEventReminder,
  renderRegistrationConfirmation,
  renderWaitlistConfirmation,
  renderWaitlistPromotion,
} from './mail/templates';
import type { MailPort } from './ports';

export type DomainEvent =
  | {
      type: 'registration.created';
      event: EventRow;
      participant: MailParticipant;
      status: RegistrationStatus;
      activeCount: number;
    }
  | {
      type: 'registration.promoted';
      event: EventRow;
      participant: MailParticipant;
    }
  | {
      type: 'reminder.due';
      event: EventRow;
      participant: MailParticipant;
      isToday: boolean;
    };

type Handler = (e: DomainEvent) => Promise<void> | void;

export class Notifier {
  private handlers: Handler[] = [];

  on(handler: Handler): void {
    this.handlers.push(handler);
  }

  async emit(event: DomainEvent): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error('[notifier] handler failed', event.type, String(err));
      }
    }
  }
}

/**
 * The default email handler. Renders the right template(s) per event and sends
 * them through the {@link MailPort}. On `registration.created` it always also
 * notifies the admin — exactly the PocketBase behaviour.
 */
export function emailHandler(mailer: MailPort): Handler {
  const send = (to: string, tpl: Rendered) =>
    mailer.send({ to, subject: tpl.subject, html: tpl.html });

  return async (event: DomainEvent) => {
    switch (event.type) {
      case 'registration.created': {
        const { event: ev, participant, status, activeCount } = event;
        if (status === 'registered') {
          await send(
            participant.email,
            renderRegistrationConfirmation(ev, participant),
          );
        } else if (status === 'waitlist') {
          await send(
            participant.email,
            renderWaitlistConfirmation(ev, participant),
          );
        }
        await send(
          config.MAIL_ADMIN_ADDRESS,
          renderAdminNotification(ev, participant, activeCount),
        );
        return;
      }
      case 'registration.promoted':
        await send(
          event.participant.email,
          renderWaitlistPromotion(event.event, event.participant),
        );
        return;
      case 'reminder.due':
        await send(
          event.participant.email,
          renderEventReminder(event.event, event.participant, event.isToday),
        );
        return;
    }
  };
}
