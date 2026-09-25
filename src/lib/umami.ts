/** Programmatic Umami events (the forms). */
export function trackEvent(eventName: string, eventData?: Record<string, string>): void {
  try {
    window.umami?.track(eventName, eventData);
  } catch {
    // Analytics must never break a form.
  }
}
