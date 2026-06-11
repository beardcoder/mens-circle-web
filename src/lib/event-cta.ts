/**
 * Hide "next event" call-to-actions when no upcoming event is scheduled.
 *
 * The site is statically built, so it can't know at build time whether a
 * termin exists. Every link/button that points users at the next event is
 * marked with `data-event-cta`; on load we ask PocketBase for the next event
 * and, if there is none, hide those elements (so there are no dead buttons).
 *
 * Elements stay visible by default — the common case is that an event exists,
 * and keeping them rendered avoids layout shift. Only the rare no-event state
 * removes them.
 */
import { getNextEvent } from './pocketbase';

export async function initEventCtas(): Promise<void> {
  const els = document.querySelectorAll<HTMLElement>('[data-event-cta]');
  if (els.length === 0) return;

  const event = await getNextEvent();
  if (event) return; // upcoming event exists → leave the CTAs visible

  els.forEach((el) => {
    // For nav <li> wrappers, hide the whole item; otherwise the element itself.
    const target = el.closest('li') ?? el;
    target.setAttribute('hidden', '');
  });
}
