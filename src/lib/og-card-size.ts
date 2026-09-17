/**
 * The share card's pixel size — 1200x630, the one number `og:image:width` and
 * `og:image:height` are allowed to be for this route.
 *
 * It lives in its own module, away from the renderer, for a measured reason:
 * `lib/server/og-card.ts` imports **satori and sharp** at module scope, and
 * `pages/event/[slug].astro` used to import these two constants from there. So
 * every visit to an event page pulled libvips and the satori layout engine into
 * the process — measured at ~46MB of RSS on a page that draws no image at all,
 * in a container the entrypoint deliberately runs with `--smol`.
 *
 * Two integers have no dependencies. Keep it that way: the renderer imports
 * them, not the other way round.
 */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
