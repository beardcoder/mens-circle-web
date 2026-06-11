/**
 * Umami Kit
 *
 * Page-level engagement tracking on top of the bare `umami.track` call.
 * Drives: scroll-depth checkpoints, time-on-page heartbeat, idle/active
 * transitions, external-link clicks, section visibility and page exit.
 *
 * Factory style. Every listener is registered against a single
 * `AbortController` so `destroy()` releases everything in one call.
 *
 * Based on https://github.com/rhelmer/umami-kit, adapted to preserve
 * the project's named event constants and avoid duplicate tracking.
 */

import { TRACKING_EVENTS, trackEvent, type UmamiEventData } from './umami';

export interface UmamiKitOptions {
  scrollDepthThresholds?: number[];
  scrollDebounceMs?: number;
  heartbeatIntervalMs?: number;
  idleTimeoutMs?: number;
  autoTrackClicks?: boolean;
  clickSelector?: string;
  visibilityThreshold?: number;
  visibilitySelector?: string;
  debug?: boolean;
}

type ResolvedOptions = Required<UmamiKitOptions>;

interface UmamiKitState {
  startTime: number;
  lastActivityAt: number;
  isIdle: boolean;
  trackedScrollDepths: Set<number>;
  visibleElementsCount: number;
}

export interface UmamiKit {
  destroy(): void;
  getStats(): {
    timeOnPageSeconds: number;
    maxScrollDepth: number;
    scrollDepthsReached: number[];
    isIdle: boolean;
    visibleElementsCount: number;
  };
}

const DEFAULTS: ResolvedOptions = {
  scrollDepthThresholds: [25, 50, 75, 90, 100],
  scrollDebounceMs: 120,
  heartbeatIntervalMs: 30_000,
  idleTimeoutMs: 60_000,
  autoTrackClicks: false,
  clickSelector: '[data-umami-track]',
  visibilityThreshold: 0.5,
  visibilitySelector: 'section[id]',
  debug: false,
};

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const;

const MAX_UMAMI_WAIT_ATTEMPTS = 80;

function waitForUmami(callback: () => void, attempts = 0): void {
  if (typeof window.umami?.track === 'function') {
    callback();

    return;
  }

  if (attempts >= MAX_UMAMI_WAIT_ATTEMPTS) {
    callback();

    return;
  }

  window.setTimeout(() => waitForUmami(callback, attempts + 1), 100);
}

function collectElementData(element: HTMLElement): UmamiEventData {
  const eventData: UmamiEventData = {};

  for (const [key, value] of Object.entries(element.dataset)) {
    if (!key.startsWith('umamiData') || !value) continue;

    const rawKey = key.slice('umamiData'.length);

    if (!rawKey) continue;

    const normalizedKey = rawKey.charAt(0).toLowerCase() + rawKey.slice(1);

    eventData[normalizedKey] = value;
  }

  eventData.element = element.tagName.toLowerCase();

  if (element.id) eventData.element_id = element.id;

  if (element.className) {
    eventData.element_classes = String(element.className).slice(0, 120);
  }

  const text = (element.textContent ?? '').trim();

  if (text) eventData.text = text.slice(0, 80);

  if (element instanceof HTMLAnchorElement && element.href) {
    eventData.href = element.href;
  }

  return eventData;
}

function isExternalLink(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);

    return parsed.hostname !== window.location.hostname;
  } catch {
    return false;
  }
}

export function createUmamiKit(options: UmamiKitOptions = {}): UmamiKit {
  const opts: ResolvedOptions = { ...DEFAULTS, ...options };
  const controller = new AbortController();
  const signal = controller.signal;

  const state: UmamiKitState = {
    startTime: Date.now(),
    lastActivityAt: Date.now(),
    isIdle: false,
    trackedScrollDepths: new Set<number>(),
    visibleElementsCount: 0,
  };

  const seenVisible = new WeakSet<Element>();

  let scrollDebounceTimer: number | null = null;
  let heartbeatTimer: number | null = null;
  let idleTimer: number | null = null;
  let visibilityObserver: IntersectionObserver | null = null;
  let pageExitTracked = false;

  const log = (...args: unknown[]): void => {
    if (!opts.debug || !import.meta.env.DEV) return;

    // eslint-disable-next-line no-console
    console.debug('[UmamiKit]', ...args);
  };

  const timeOnPageSeconds = (): number =>
    Math.max(1, Math.round((Date.now() - state.startTime) / 1000));

  const checkScrollDepth = (): void => {
    const range = document.documentElement.scrollHeight - window.innerHeight;

    if (range <= 0) return;

    const percent = Math.min(100, Math.round((window.scrollY / range) * 100));

    for (const threshold of opts.scrollDepthThresholds) {
      if (percent >= threshold && !state.trackedScrollDepths.has(threshold)) {
        state.trackedScrollDepths.add(threshold);

        trackEvent(TRACKING_EVENTS.SCROLL_DEPTH, {
          depth: threshold,
          percentage: `${threshold}%`,
          pixels: Math.round(window.scrollY),
          page: window.location.pathname,
        });
      }
    }
  };

  const trackPageExit = (): void => {
    if (pageExitTracked) return;

    pageExitTracked = true;

    const reached = Array.from(state.trackedScrollDepths);

    trackEvent(TRACKING_EVENTS.PAGE_EXIT, {
      total_time_seconds: timeOnPageSeconds(),
      max_scroll_depth: reached.length > 0 ? Math.max(...reached) : 0,
      scroll_depth_count: reached.length,
      page: window.location.pathname,
    });
  };

  const setupScrollTracking = (): void => {
    window.addEventListener(
      'scroll',
      () => {
        if (scrollDebounceTimer !== null) {
          window.clearTimeout(scrollDebounceTimer);
        }

        scrollDebounceTimer = window.setTimeout(
          checkScrollDepth,
          opts.scrollDebounceMs,
        );
      },
      { passive: true, signal },
    );

    checkScrollDepth();
  };

  const setupTimeTracking = (): void => {
    heartbeatTimer = window.setInterval(() => {
      if (state.isIdle) return;

      const seconds = timeOnPageSeconds();

      trackEvent(TRACKING_EVENTS.TIME_ON_PAGE, {
        seconds,
        minutes: Math.round(seconds / 60),
        page: window.location.pathname,
      });
    }, opts.heartbeatIntervalMs);
  };

  const setupIdleTracking = (): void => {
    const onActivity = (): void => {
      const now = Date.now();

      if (state.isIdle) {
        const idleDurationSeconds = Math.max(
          1,
          Math.round((now - state.lastActivityAt) / 1000),
        );

        state.isIdle = false;

        trackEvent(TRACKING_EVENTS.USER_ACTIVE, {
          idle_duration_seconds: idleDurationSeconds,
          page: window.location.pathname,
        });
      }

      state.lastActivityAt = now;
    };

    for (const eventName of ACTIVITY_EVENTS) {
      document.addEventListener(eventName, onActivity, {
        passive: true,
        signal,
      });
    }

    idleTimer = window.setInterval(() => {
      if (state.isIdle) return;

      const idleDuration = Date.now() - state.lastActivityAt;

      if (idleDuration < opts.idleTimeoutMs) return;

      state.isIdle = true;

      trackEvent(TRACKING_EVENTS.USER_IDLE, {
        active_before_idle_seconds: Math.round(opts.idleTimeoutMs / 1000),
        page: window.location.pathname,
      });
    }, 30_000);
  };

  const setupClickTracking = (): void => {
    document.addEventListener(
      'click',
      (event: MouseEvent) => {
        if (!(event.target instanceof Element)) return;

        if (opts.autoTrackClicks) {
          const tracked = event.target.closest<HTMLElement>(opts.clickSelector);

          if (tracked) {
            const name = tracked.dataset.umamiTrack ?? TRACKING_EVENTS.CLICK;

            trackEvent(name, collectElementData(tracked));
          }
        }

        const link = event.target.closest<HTMLAnchorElement>('a[href]');

        if (
          !link ||
          !isExternalLink(link.href) ||
          link.hasAttribute('data-umami-event')
        ) {
          return;
        }

        trackEvent(TRACKING_EVENTS.EXTERNAL_LINK, {
          ...collectElementData(link),
          url: link.href,
          text: (link.textContent ?? '').trim().slice(0, 80),
          page: window.location.pathname,
        });
      },
      { passive: true, signal },
    );
  };

  const setupVisibilityTracking = (): void => {
    if (!('IntersectionObserver' in window)) return;

    const elements = document.querySelectorAll<HTMLElement>(
      opts.visibilitySelector,
    );

    if (elements.length === 0) return;

    visibilityObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const element = entry.target as HTMLElement;

          if (seenVisible.has(element)) continue;

          seenVisible.add(element);
          state.visibleElementsCount += 1;

          const name =
            element.dataset.umamiVisible ?? TRACKING_EVENTS.SECTION_VISIBLE;

          trackEvent(name, {
            ...collectElementData(element),
            element_id: element.id || 'unknown',
            visibility_ratio: Math.round(entry.intersectionRatio * 100),
            page: window.location.pathname,
          });
        }
      },
      { threshold: opts.visibilityThreshold },
    );

    for (const element of elements) visibilityObserver.observe(element);
  };

  const setupPageExitTracking = (): void => {
    window.addEventListener('pagehide', trackPageExit, {
      capture: true,
      signal,
    });
    window.addEventListener('beforeunload', trackPageExit, {
      capture: true,
      signal,
    });
  };

  waitForUmami(() => {
    setupScrollTracking();
    setupTimeTracking();
    setupIdleTracking();
    setupClickTracking();
    setupVisibilityTracking();
    setupPageExitTracking();
    log('Initialized');
  });

  return {
    destroy(): void {
      controller.abort();

      if (scrollDebounceTimer !== null)
        window.clearTimeout(scrollDebounceTimer);
      if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
      if (idleTimer !== null) window.clearInterval(idleTimer);

      visibilityObserver?.disconnect();
      visibilityObserver = null;
    },
    getStats() {
      const reached = Array.from(state.trackedScrollDepths);

      return {
        timeOnPageSeconds: timeOnPageSeconds(),
        maxScrollDepth: reached.length > 0 ? Math.max(...reached) : 0,
        scrollDepthsReached: reached.sort((a, b) => a - b),
        isIdle: state.isIdle,
        visibleElementsCount: state.visibleElementsCount,
      };
    },
  };
}

declare global {
  interface Window {
    umamiTracker?: UmamiKit;
  }
}

export function initUmamiKit(options: UmamiKitOptions = {}): UmamiKit {
  const tracker = createUmamiKit(options);

  window.umamiTracker = tracker;

  return tracker;
}
