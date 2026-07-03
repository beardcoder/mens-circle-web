/**
 * Scroll-triggered reveals. Motion's `inView()` shares an IntersectionObserver;
 * the mini `animate()` drives the Web Animations API directly (tiny bundle).
 * The hidden start state lives in CSS (utilities/_motion.css) behind
 * `.motion-ready`, so without JS or under reduced motion everything stays
 * visible and still. Content added after load (server islands) is picked up
 * by a MutationObserver.
 *
 * Markup:
 *   data-reveal="up|down|left|right|fade|zoom|blur"   (default "up")
 *   data-reveal-delay / data-reveal-duration          ms overrides
 *   data-reveal-repeat                                replay on every entry
 *   data-reveal-group[="110"]                         stagger direct children
 */

import { inView } from 'motion';
import { animate } from 'motion/mini';

type DOMKeyframes = Parameters<typeof animate>[1];

type Variant = 'up' | 'down' | 'left' | 'right' | 'fade' | 'zoom' | 'blur';

const EASE: [number, number, number, number] = [0.33, 0, 0.2, 1];

// Phones get shorter travel, quicker beats and no blur (scroll-jank source).
interface Tuning {
  shift: string;
  zoom: number;
  blur: string;
  duration: number;
  blurDuration: number;
  step: number;
}

const DESKTOP: Tuning = {
  shift: '1.5rem',
  zoom: 0.94,
  blur: '12px',
  duration: 0.88,
  blurDuration: 1.15,
  step: 110,
};

const MOBILE: Tuning = {
  shift: '0.75rem',
  zoom: 0.94,
  blur: '0px',
  duration: 0.7,
  blurDuration: 0.76,
  step: 80,
};

interface Keyframes {
  opacity: [number, number];
  transform?: [string, string];
  filter?: [string, string];
}

interface RevealConfig {
  enter: Keyframes;
  duration: number;
  delay: number;
  repeat: boolean;
}

// Composited properties only (transform/filter/opacity) — nothing reflows.
function keyframesFor(variant: Variant, t: Tuning): Keyframes {
  switch (variant) {
    case 'down':
      return {
        opacity: [0, 1],
        transform: [`translateY(-${t.shift})`, 'translateY(0)'],
      };
    case 'right':
      return {
        opacity: [0, 1],
        transform: [`translateX(-${t.shift})`, 'translateX(0)'],
      };
    case 'left':
      return {
        opacity: [0, 1],
        transform: [`translateX(${t.shift})`, 'translateX(0)'],
      };
    case 'fade':
      return { opacity: [0, 1] };
    case 'zoom':
      return { opacity: [0, 1], transform: [`scale(${t.zoom})`, 'scale(1)'] };
    case 'blur':
      return t.blur === '0px'
        ? {
            opacity: [0, 1],
            transform: ['translateY(0.75rem)', 'translateY(0)'],
          }
        : {
            opacity: [0, 1],
            transform: ['translateY(0.6rem)', 'translateY(0)'],
            filter: [`blur(${t.blur})`, 'blur(0px)'],
          };
    default:
      return {
        opacity: [0, 1],
        transform: [`translateY(${t.shift})`, 'translateY(0)'],
      };
  }
}

function ms(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function defaultDuration(variant: Variant, t: Tuning): number {
  return variant === 'blur' ? t.blurDuration * 1000 : t.duration * 1000;
}

const configs = new WeakMap<HTMLElement, RevealConfig>();
const registered = new WeakSet<HTMLElement>();

function configFor(el: HTMLElement, tuning: Tuning, extraDelay = 0): RevealConfig {
  const variant = (el.dataset.reveal || 'up') as Variant;

  return {
    enter: keyframesFor(variant, tuning),
    duration: (ms(el.dataset.revealDuration) ?? defaultDuration(variant, tuning)) / 1000,
    delay: ((ms(el.dataset.revealDelay) ?? 0) + extraDelay) / 1000,
    repeat: el.dataset.revealRepeat !== undefined,
  };
}

function matching(root: HTMLElement, selector: string): HTMLElement[] {
  const found = Array.from(root.querySelectorAll<HTMLElement>(selector));

  if (root.matches(selector)) {
    found.unshift(root);
  }

  return found;
}

// Register every unseen [data-reveal] under `root`. Group children inherit a
// per-index stagger; individual overrides layer on top.
function register(root: HTMLElement, tuning: Tuning): HTMLElement[] {
  const fresh: HTMLElement[] = [];

  for (const group of matching(root, '[data-reveal-group]')) {
    const step = ms(group.dataset.revealGroup) ?? tuning.step;
    const children = group.querySelectorAll<HTMLElement>(':scope > [data-reveal]');

    children.forEach((child, index) => {
      if (registered.has(child)) {
        return;
      }

      registered.add(child);
      configs.set(child, configFor(child, tuning, index * step));
      fresh.push(child);
    });
  }

  for (const el of matching(root, '[data-reveal]')) {
    if (registered.has(el)) {
      continue;
    }

    registered.add(el);
    configs.set(el, configFor(el, tuning));
    fresh.push(el);
  }

  return fresh;
}

function observe(elements: HTMLElement[]): void {
  if (elements.length === 0) {
    return;
  }

  // Fire slightly before full visibility so the entrance reads as the eye arrives.
  inView(
    elements,
    (element) => {
      const el = element as HTMLElement;
      const config = configs.get(el);

      if (config === undefined) {
        return;
      }

      reveal(el, config);

      // Returning a handler keeps the element observed (repeat) and replays on re-entry.
      return config.repeat ? () => hide(el, config) : undefined;
    },
    { margin: '0px 0px -12% 0px', amount: 'some' },
  );
}

export function initMotion(): void {
  // Under reduced motion the CSS start state never applies — nothing to do.
  if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const tuning = globalThis.matchMedia('(width < 640px)').matches ? MOBILE : DESKTOP;

  observe(register(document.body, tuning));

  // Server islands swap their content in after load — register what arrives.
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          observe(register(node, tuning));
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}

// `will-change` is held only for the life of the animation.
function reveal(el: HTMLElement, config: RevealConfig): void {
  el.style.willChange = 'transform, opacity';

  const controls = animate(el, config.enter as unknown as DOMKeyframes, {
    duration: config.duration,
    delay: config.delay,
    ease: EASE,
  });

  controls.finished
    .then(() => {
      el.style.willChange = '';
    })
    .catch(() => {
      el.style.willChange = '';
    });
}

function hide(el: HTMLElement, config: RevealConfig): void {
  const { enter } = config;
  const exit: Keyframes = { opacity: [enter.opacity[1], enter.opacity[0]] };

  if (enter.transform) {
    exit.transform = [enter.transform[1], enter.transform[0]];
  }

  if (enter.filter) {
    exit.filter = [enter.filter[1], enter.filter[0]];
  }

  animate(el, exit as unknown as DOMKeyframes, {
    duration: config.duration * 0.75,
    ease: EASE,
  });
}
