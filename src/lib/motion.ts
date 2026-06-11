/**
 * Motion — scroll-triggered reveals (Motion Mini)
 *
 * Motion's `inView()` runs a single shared IntersectionObserver that decides
 * *when* an element enters the viewport; Motion One's mini `animate()` carries
 * the motion itself, driving the Web Animations API directly. This keeps the
 * bundle tiny (mini ships only the WAAPI path — no spring/layout engine) while
 * giving us JS-precise easing, stagger and a `finished` promise we use to drop
 * `will-change` the instant a transition settles — keeping the compositor lean
 * on mobile.
 *
 * `inView` also folds away the bookkeeping we'd otherwise hand-roll: returning
 * nothing from the enter callback auto-unobserves the element (reveal once),
 * while returning a handler keeps it observed and replays on every entry
 * (`data-reveal-repeat`).
 *
 * The hidden start state lives in CSS (utilities/_motion.css), gated behind
 * `.motion-ready` on <html>, so nothing flashes before this script runs and —
 * under reduced motion or with JS disabled — every element simply stays
 * visible and still.
 *
 * Markup:
 *   <h2 data-reveal>                       fade + rise (default = "up")
 *   <p  data-reveal="blur">                headline burn-in
 *   <a  data-reveal="up" data-reveal-delay="120">
 *   <img data-reveal="zoom" data-reveal-duration="900">
 *   <li data-reveal="up" data-reveal-repeat>   replays on every entry
 *
 * Auto-stagger the direct children of a group:
 *   <ul data-reveal-group>                 default step
 *   <ul data-reveal-group="120">           custom step in ms
 *     <li data-reveal="up">…</li>
 *     <li data-reveal="up">…</li>
 *   </ul>
 */

import { inView } from 'motion';
import { animate } from 'motion/mini';

/** The keyframe-definition type `animate()` accepts, drawn from its own
 *  signature so we don't depend on Motion re-exporting it. */
type DOMKeyframes = Parameters<typeof animate>[1];

type Variant = 'up' | 'down' | 'left' | 'right' | 'fade' | 'zoom' | 'blur';

/** Easing — mirrors `--ease-reveal`: a soft start that reads across the full
 *  duration rather than the front-loaded snap of an emphasised curve. */
const EASE: [number, number, number, number] = [0.33, 0, 0.2, 1];

/** Per-viewport tuning. Phones get smaller travel, quicker beats and a tighter
 *  stagger so a whole sequence resolves inside a single thumb-flick — and the
 *  headline burn-in drops its blur, the classic source of mobile scroll jank. */
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

/**
 * Resolve the hidden → resting keyframes for a reveal variant. Motion drives
 * the `transform` shorthand and `filter` only — never layout properties — so
 * nothing reflows as it animates.
 */
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

/** Read a positive numeric dataset value in ms, or `null` if absent/invalid. */
function ms(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Build the reveal config for every `[data-reveal]`. Group children inherit a
 * per-index stagger from their `[data-reveal-group]` parent; individual
 * `data-reveal-delay` / `data-reveal-duration` overrides layer on top.
 */
function collect(tuning: Tuning): Map<HTMLElement, RevealConfig> {
  const configs = new Map<HTMLElement, RevealConfig>();
  const staggered = new Set<HTMLElement>();

  for (const group of document.querySelectorAll<HTMLElement>(
    '[data-reveal-group]',
  )) {
    const step = ms(group.dataset.revealGroup) ?? tuning.step;
    const children = group.querySelectorAll<HTMLElement>(
      ':scope > [data-reveal]',
    );

    children.forEach((child, index) => {
      const variant = (child.dataset.reveal || 'up') as Variant;
      const base = ms(child.dataset.revealDelay) ?? 0;

      configs.set(child, {
        enter: keyframesFor(variant, tuning),
        duration:
          (ms(child.dataset.revealDuration) ??
            defaultDuration(variant, tuning)) / 1000,
        delay: (base + index * step) / 1000,
        repeat: child.dataset.revealRepeat !== undefined,
      });
      staggered.add(child);
    });
  }

  for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
    if (staggered.has(el)) {
      continue;
    }

    const variant = (el.dataset.reveal || 'up') as Variant;

    configs.set(el, {
      enter: keyframesFor(variant, tuning),
      duration:
        (ms(el.dataset.revealDuration) ?? defaultDuration(variant, tuning)) /
        1000,
      delay: (ms(el.dataset.revealDelay) ?? 0) / 1000,
      repeat: el.dataset.revealRepeat !== undefined,
    });
  }

  return configs;
}

function defaultDuration(variant: Variant, t: Tuning): number {
  return variant === 'blur' ? t.blurDuration * 1000 : t.duration * 1000;
}

export function initMotion(): void {
  // Reduced motion: the hidden start state never applies (it is gated behind
  // `prefers-reduced-motion: no-preference` in CSS), so content is already
  // visible — there is nothing to animate or observe.
  if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const tuning = globalThis.matchMedia('(width < 640px)').matches
    ? MOBILE
    : DESKTOP;
  const configs = collect(tuning);

  if (configs.size === 0) {
    return;
  }

  // A single shared observer for every reveal. Firing a touch before the
  // element is fully in view (the `-12%` bottom margin) lets the entrance read
  // as the eye arrives, rather than after.
  inView(
    Array.from(configs.keys()),
    (element) => {
      const el = element as HTMLElement;
      const config = configs.get(el);

      if (config === undefined) {
        return;
      }

      reveal(el, config);

      // Repeat elements stay observed and replay on each re-entry; everything
      // else returns nothing, so `inView` unobserves it after the first play.
      return config.repeat ? () => hide(el, config) : undefined;
    },
    { margin: '0px 0px -12% 0px', amount: 'some' },
  );
}

/**
 * Play the entrance. `will-change` is promoted only for the life of the
 * animation and dropped on `finished` — so dozens of revealed elements never
 * leave permanent compositor layers behind.
 */
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
      // Animation was cancelled (e.g. a repeat element left the viewport mid-play).
      el.style.willChange = '';
    });
}

/** Reverse the entrance for `data-reveal-repeat` elements leaving the viewport. */
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
