/**
 * Scroll-triggered reveals. The hidden start state lives in CSS behind
 * `.motion-ready`, so without JS or under reduced motion everything stays
 * visible. All reveal targets arrive in the initial Astro HTML, so no body-wide
 * mutation observer is needed.
 *
 * Markup:
 *   data-reveal[="up"|"fade"]      a rise (default) or a plain cross-fade
 *   data-reveal-group[="55"]       stagger direct children, ms between them
 */

import { inView } from 'motion';
import { animate } from 'motion/mini';

type DOMKeyframes = Parameters<typeof animate>[1];

const EASE: [number, number, number, number] = [0.33, 0, 0.2, 1];

/** Phones get shorter travel and quicker beats. */
interface Tuning {
  shift: string;
  duration: number;
  step: number;
}

const DESKTOP: Tuning = { shift: '0.6rem', duration: 0.36, step: 55 };
const MOBILE: Tuning = { shift: '0.4rem', duration: 0.3, step: 45 };

/** Composited properties only — nothing here reflows. */
interface Keyframes {
  opacity: [number, number];
  transform?: [string, string];
}

interface RevealConfig {
  enter: Keyframes;
  delay: number;
}

const keyframesFor = (el: HTMLElement, t: Tuning): Keyframes =>
  el.dataset.reveal === 'fade'
    ? { opacity: [0, 1] }
    : { opacity: [0, 1], transform: [`translateY(${t.shift})`, 'translateY(0)'] };

const configs = new WeakMap<HTMLElement, RevealConfig>();
const registered = new WeakSet<HTMLElement>();

/** Timer id parked on `window` by the layout's inline boot script. */
declare global {
  interface Window {
    __mcMotionFallback?: ReturnType<typeof setTimeout>;
  }
}

/** Stand down the layout's "show everything" timer. */
function clearMotionFallback(): void {
  if (window.__mcMotionFallback !== undefined) {
    clearTimeout(window.__mcMotionFallback);
    window.__mcMotionFallback = undefined;
  }
}

function matching(root: HTMLElement, selector: string): HTMLElement[] {
  const found = Array.from(root.querySelectorAll<HTMLElement>(selector));
  if (root.matches(selector)) found.unshift(root);
  return found;
}

function add(el: HTMLElement, tuning: Tuning, delay: number, fresh: HTMLElement[]): void {
  if (registered.has(el)) return;
  registered.add(el);
  configs.set(el, { enter: keyframesFor(el, tuning), delay: delay / 1000 });
  fresh.push(el);
}

/** Register unseen [data-reveal] under `root`; group children get a stagger. */
function register(root: HTMLElement, tuning: Tuning): HTMLElement[] {
  const fresh: HTMLElement[] = [];

  for (const group of matching(root, '[data-reveal-group]')) {
    const parsed = Number(group.dataset.revealGroup);
    const step = Number.isFinite(parsed) && parsed >= 0 ? parsed : tuning.step;
    const children = group.querySelectorAll<HTMLElement>(':scope > [data-reveal]');
    children.forEach((child, index) => add(child, tuning, index * step, fresh));
  }

  for (const el of matching(root, '[data-reveal]')) add(el, tuning, 0, fresh);

  return fresh;
}

/** `will-change` is held only for the life of the animation. */
function reveal(el: HTMLElement, config: RevealConfig, duration: number): void {
  el.style.willChange = 'transform, opacity';

  const done = (): void => {
    el.style.willChange = '';
  };

  animate(el, config.enter as unknown as DOMKeyframes, { duration, delay: config.delay, ease: EASE }).finished.then(
    done,
    done,
  );
}

export function initMotion(): void {
  if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    clearMotionFallback();
    return;
  }

  const tuning = globalThis.matchMedia('(width < 640px)').matches ? MOBILE : DESKTOP;
  const elements = register(document.body, tuning);

  if (elements.length > 0) {
    inView(
      elements,
      (element) => {
        const el = element as HTMLElement;
        const config = configs.get(el);
        if (config) reveal(el, config, tuning.duration);
      },
      // Fire slightly before full visibility, so the entrance reads as the eye arrives.
      { margin: '0px 0px -12% 0px', amount: 'some' },
    );
  }

  // Reveals are observed now, so the layout's dead-man's switch can stand down.
  clearMotionFallback();
}
