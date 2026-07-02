/**
 * Umami Analytics Tracking Utility
 * Provides type-safe event tracking for Umami Analytics
 *
 * The `window.umami` global is declared in `./types`.
 */

export interface UmamiEventData {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Track a custom event in Umami Analytics
 */
export function trackEvent(eventName: string, eventData?: UmamiEventData): void {
  if (typeof window.umami === 'undefined') {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[Umami] Event:', eventName, eventData);
    }

    return;
  }

  try {
    window.umami.track(eventName, eventData);
  } catch (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[Umami] Tracking error:', error);
    }
  }
}

/**
 * Predefined event names for programmatic tracking (form islands, calendar).
 *
 * Click-style events (cta-click, nav-click, footer-link, contact-click,
 * social-click, whatsapp-click, faq-expand) are tracked declaratively via
 * `data-umami-event` attributes in the markup — Umami's own tracker script
 * handles those, no custom code involved.
 */
export const TRACKING_EVENTS = {
  NEWSLETTER_SUBMIT: 'newsletter-submit',
  NEWSLETTER_SUCCESS: 'newsletter-success',
  NEWSLETTER_ERROR: 'newsletter-error',

  EVENT_REGISTRATION_SUBMIT: 'event-registration-submit',
  EVENT_REGISTRATION_SUCCESS: 'event-registration-success',
  EVENT_REGISTRATION_ERROR: 'event-registration-error',

  TESTIMONIAL_SUBMIT: 'testimonial-submit',
  TESTIMONIAL_SUCCESS: 'testimonial-success',
  TESTIMONIAL_ERROR: 'testimonial-error',

  CALENDAR_OPEN: 'calendar-open',
  CALENDAR_DOWNLOAD_ICS: 'calendar-download-ics',
  CALENDAR_DOWNLOAD_GOOGLE: 'calendar-download-google',
} as const;
