/** Old event-specific share URLs now point to the shared static poster. */
import type { APIRoute } from 'astro';

export const prerender = false;
export const GET: APIRoute = ({ url }) => Response.redirect(new URL('/images/og-default.png', url), 301);
