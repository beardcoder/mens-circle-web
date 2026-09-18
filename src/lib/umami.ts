/**
 * Programmatic Umami events (the forms). Click-style events are tracked
 * declaratively via `data-umami-event` in the markup. The `window.umami` global
 * lives in `./types`.
 */
export function trackEvent(eventName: string, eventData?: Record<string, string>): void {
  try {
    window.umami?.track(eventName, eventData);
  } catch {
    // Analytics must never break a form.
  }
}
