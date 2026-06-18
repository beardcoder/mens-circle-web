/**
 * Composition root — wires the database, ports (mail + newsletter) and services
 * together once and hands them to the API routes, SSR pages, admin and cron.
 * This is the *only* place that knows the concrete implementations, so swapping
 * a host (D1 instead of bun:sqlite, Resend instead of SMTP) is a one-file change.
 */
import { getDb } from './db';
import { listmonk } from './infra/listmonk';
import { smtpMailer } from './mail/transport';
import { emailHandler, Notifier } from './notifications';
import { createEventService } from './services/events';
import { createRegistrationService } from './services/registrations';
import { createReminderService } from './services/reminders';
import { createTestimonialService } from './services/testimonials';

export interface Services {
  events: ReturnType<typeof createEventService>;
  registrations: ReturnType<typeof createRegistrationService>;
  testimonials: ReturnType<typeof createTestimonialService>;
  reminders: ReturnType<typeof createReminderService>;
}

let _services: Services | null = null;

export function getServices(): Services {
  if (_services) return _services;

  const db = getDb();
  const notifier = new Notifier();
  notifier.on(emailHandler(smtpMailer));

  const events = createEventService(db);
  const registrations = createRegistrationService(
    db,
    events,
    notifier,
    listmonk,
  );
  const testimonials = createTestimonialService(db);
  const reminders = createReminderService(db, events, notifier);

  _services = { events, registrations, testimonials, reminders };
  return _services;
}
