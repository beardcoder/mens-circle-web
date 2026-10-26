/** Every Astro Action, served at `/_actions/*` and called as `actions.<name>()`. */
import { admin } from './admin';
import { auth } from './auth';
import { events } from './events';
import { forms } from './forms';
import { registrations } from './registrations';
import { testimonials } from './testimonials';

export const server = { ...admin, ...forms, ...auth, ...events, ...registrations, ...testimonials };
