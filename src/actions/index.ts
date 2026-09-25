/** Every Astro Action, served at `/_actions/*` and called as `actions.<name>()`. */
import { auth } from './auth';
import { events } from './events';
import { forms } from './forms';
import { registrations } from './registrations';
import { testimonials } from './testimonials';

export const server = { ...forms, ...auth, ...events, ...registrations, ...testimonials };
