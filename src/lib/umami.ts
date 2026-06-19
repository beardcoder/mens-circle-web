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
 * Predefined event names for consistent tracking
 */
export const TRACKING_EVENTS = {
  NEWSLETTER_SUBMIT: 'newsletter-submit',
  NEWSLETTER_SUCCESS: 'newsletter-success',
  NEWSLETTER_ERROR: 'newsletter-error',
  NEWSLETTER_ABANDON_FILLED: 'newsletter-abandon-filled',

  EVENT_REGISTRATION_SUBMIT: 'event-registration-submit',
  EVENT_REGISTRATION_SUCCESS: 'event-registration-success',
  EVENT_REGISTRATION_ERROR: 'event-registration-error',
  EVENT_REGISTRATION_ABANDON_FILLED: 'event-registration-abandon-filled',

  TESTIMONIAL_SUBMIT: 'testimonial-submit',
  TESTIMONIAL_SUCCESS: 'testimonial-success',
  TESTIMONIAL_ERROR: 'testimonial-error',
  TESTIMONIAL_ABANDON_FILLED: 'testimonial-abandon-filled',

  CALENDAR_OPEN: 'calendar-open',
  CALENDAR_DOWNLOAD_ICS: 'calendar-download-ics',
  CALENDAR_DOWNLOAD_GOOGLE: 'calendar-download-google',

  CTA_CLICK: 'cta-click',
  SOCIAL_CLICK: 'social-click',
  WHATSAPP_CLICK: 'whatsapp-click',
  EXTERNAL_LINK: 'external-link',
  CLICK: 'click',

  FAQ_EXPAND: 'faq-expand',
  SCROLL_DEPTH: 'scroll-depth',
  TIME_ON_PAGE: 'time-on-page',
  USER_IDLE: 'user-idle',
  USER_ACTIVE: 'user-active',
  PAGE_EXIT: 'page-exit',
  SECTION_VISIBLE: 'section-visible',

  NAV_CLICK: 'nav-click',
  FOOTER_LINK: 'footer-link',
  CONTACT_CLICK: 'contact-click',
} as const;
