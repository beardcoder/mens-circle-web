/**
 * Every Astro Action, served at `/_actions/*` and called as `actions.<name>()`.
 * Split by area; the names stay flat so callers never see the split.
 *
 *   forms          the public forms (registration, newsletter, testimonial)
 *   auth           admin login/logout, and `requireAdmin` for the rest
 *   events, registrations, testimonials   the admin back-office
 */
import { auth } from './auth';
import { events } from './events';
import { forms } from './forms';
import { registrations } from './registrations';
import { testimonials } from './testimonials';

export const server = { ...forms, ...auth, ...events, ...registrations, ...testimonials };
