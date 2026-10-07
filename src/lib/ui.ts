/**
 * Class recipes of the design system — complete, static Tailwind class strings, so
 * Tailwind finds every class and components never assemble fragments. The `.astro`
 * components in `src/components/ui/` wrap these; scripts that build DOM (toasts,
 * the map popup) and the admin use them directly. See docs/design-system.md.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

/** A pill in small bold capitals that lifts a little and glows on hover. */
const BUTTON_BASE =
  'group/btn relative inline-flex items-center justify-center rounded-full border-[1.5px] text-center font-sans font-bold uppercase tracking-label leading-tight whitespace-nowrap no-underline transition-[background-color,color,border-color,box-shadow,translate,scale] duration-[420ms] ease-settle active:scale-[0.975] active:duration-150 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 motion-reduce:active:scale-100 [@media(hover:hover)]:hover:-translate-y-0.5 motion-reduce:[@media(hover:hover)]:hover:translate-y-0';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  /** The fill (terracotta; green on the forest band) with a bone label. */
  primary:
    'border-transparent bg-fill text-on-fill shadow-card hover:bg-fill-strong hover:shadow-[var(--shadow-lift),var(--shadow-glow)]',
  /** Outlined in the text colour, filling with it on hover. */
  secondary: 'border-fg bg-transparent text-fg hover:bg-fg hover:text-surface hover:shadow-card',
  /** Outlined for a dark ground: a faint sand glass. */
  outline: 'border-sand/25 bg-sand/8 text-fg backdrop-blur-sm hover:border-sand/40 hover:bg-sand/15',
  ghost: 'border-transparent bg-transparent text-accent hover:bg-accent-soft',
  danger: 'border-danger bg-transparent text-danger hover:bg-danger hover:text-surface',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  /** The admin's dense row buttons: still well clear of the 24px minimum target. */
  xs: 'min-h-9 gap-1.5 px-4 py-1.5 text-xs',
  sm: 'min-h-11 gap-2 px-5 py-2.5 text-xs',
  md: 'min-h-12 gap-2.5 px-9 py-4 text-[0.8125rem]',
  lg: 'min-h-14 gap-3 px-11 py-5 text-sm',
};

export const button = ({
  variant = 'primary',
  size = 'md',
  block = false,
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean } = {}): string =>
  [BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], block ? 'w-full' : ''].filter(Boolean).join(' ');

/** A link inside running text: the accent, underlined. */
export const link =
  'text-accent underline decoration-1 underline-offset-[3px] transition-colors duration-150 hover:text-fg focus-visible:text-fg';

export type ControlSize = 'md' | 'sm' | 'xs';

const CONTROL_BASE =
  'border border-line-bold bg-field font-sans text-fg placeholder:text-fg-muted transition-[border-color,box-shadow,background-color] duration-300 ease-precise hover:not-focus:not-disabled:border-fg-muted focus-visible:border-fill focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-fill/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-[3px] aria-invalid:ring-danger/20';

/** 16px at least on the public forms: anything smaller makes iOS zoom on focus. */
const CONTROL_SIZES: Record<ControlSize, string> = {
  md: 'block min-h-13 w-full px-4.5 py-3 text-base leading-normal',
  sm: 'block min-h-10 w-full px-3 py-2 text-sm leading-normal',
  /** A select inside a dense admin row. */
  xs: 'inline-block min-h-9 w-auto px-2.5 py-1.5 text-sm leading-normal',
};

/** Text inputs, textareas and selects. `md` on the public forms, `sm` and `xs` in the admin; `pill` for a lone address beside its button. */
export const control = (size: ControlSize = 'md', pill = false): string =>
  `${CONTROL_BASE} ${CONTROL_SIZES[size]} ${pill ? 'rounded-full' : 'rounded-control'}`;

/** Field labels in the accent's small capitals. */
export const fieldLabel = 'mb-2 block text-xs font-bold tracking-label text-accent uppercase';
export const fieldHint = 'mt-1.5 block text-sm text-fg-muted';
/** Written by lib/form.ts; `hidden` until the action rejects the field. Colour is
 *  never the only signal: the message carries a mark of its own. */
export const fieldError =
  'mt-2 flex w-fit items-start gap-1.5 rounded-control bg-alert px-3 py-1.5 text-sm font-semibold text-on-alert before:font-bold before:content-["!"]';
export const checkbox = 'mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-fill';

/** A label in small bold capitals, spaced wide: terms, "Nächster Termin". Add the colour. */
export const caps = 'text-xs font-bold tracking-label uppercase';

/** A card: a self-contained unit on the page (a date, a form), raised on a soft shadow. */
export const card = 'rounded-card border border-line bg-raised shadow-card';

/** A card's padding, for the larger cards that hold a form or a date. */
export const panel = `${card} p-6 sm:p-10`;
