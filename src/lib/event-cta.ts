/**
 * Client-side gating for the "next event" CTAs.
 *
 * Every CTA that points at the next event carries `data-event-cta` and is
 * HIDDEN by default via CSS (see styles/utilities/_visual.css). Since the pages
 * that carry these CTAs are prerendered (static), whether an event is actually
 * scheduled can only be known at runtime — so we check it here and reveal the
 * CTAs by adding the `has-upcoming-event` class to <body> only when one is
 * confirmed. Because the default is hidden and we only ever ADD the class,
 * there is no flicker and no dead button in the empty/offline state.
 *
 * The result is memoised in sessionStorage for a minute so navigating between
 * pages in a visit doesn't re-hit the API.
 */
import { PB_BASE_URL } from './pocketbase';

const CACHE_KEY = 'mc:has-upcoming-event';
const TTL_MS = 60_000;

function readCache(): boolean | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { value, at } = JSON.parse(raw) as { value: boolean; at: number };
    if (Date.now() - at >= TTL_MS) return null;
    return value;
  } catch {
    return null;
  }
}

function writeCache(value: boolean): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ value, at: Date.now() }));
  } catch {
    // sessionStorage unavailable (private mode / disabled) — just skip caching.
  }
}

function reveal(): void {
  document.body.classList.add('has-upcoming-event');
}

/** Reveal the event CTAs iff an upcoming event is scheduled. */
export async function initEventCtas(): Promise<void> {
  const cached = readCache();
  if (cached !== null) {
    if (cached) reveal();
    return;
  }

  try {
    const res = await fetch(`${PB_BASE_URL}/api/public/events/next`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return; // leave hidden on error — no dead button
    const data = (await res.json()) as { event: unknown | null };
    const has = Boolean(data?.event);
    writeCache(has);
    if (has) reveal();
  } catch {
    // network error — leave the CTAs hidden.
  }
}
