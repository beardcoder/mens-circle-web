/**
 * Class recipes of the design system — complete, static Tailwind class strings, so
 * Tailwind finds every class and components never assemble fragments. The `.astro`
 * components in `src/components/ui/` wrap these; scripts that build DOM (toasts,
 * the map popup) and the admin use them directly. See docs/design-system.md.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'group/btn relative inline-flex items-center justify-center rounded-control border-[1.5px] text-center font-sans font-bold leading-tight tracking-[0.005em] no-underline transition-[background-color,color,border-color,scale] duration-150 ease-precise active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 motion-reduce:active:scale-100';

/** Hover always turns a button to the ground's text colour, so it reads on every surface. */
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-accent bg-accent text-on-accent hover:border-fg hover:bg-fg hover:text-surface',
  secondary: 'border-line-bold bg-transparent text-fg hover:border-fg hover:bg-fg hover:text-surface',
  ghost:
    'border-transparent bg-transparent text-fg-soft underline decoration-accent decoration-[1.5px] underline-offset-4 hover:text-fg',
  danger: 'border-danger bg-transparent text-danger hover:bg-danger hover:text-surface',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  /** The admin's dense row buttons: still well clear of the 24px minimum target. */
  xs: 'min-h-9 gap-1.5 px-3 py-1 text-sm',
  sm: 'min-h-11 gap-2 px-4 py-2 text-sm',
  md: 'min-h-12 gap-3 px-5 py-3 text-base',
  lg: 'min-h-14 gap-3 px-6 py-4 text-base',
};

export const button = ({
  variant = 'primary',
  size = 'md',
  block = false,
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean } = {}): string =>
  [BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], block ? 'w-full' : ''].filter(Boolean).join(' ');

/** A link inside running text: a hairline in the accent that thickens on hover. */
export const link =
  'text-fg underline decoration-accent decoration-[1.5px] underline-offset-[0.22em] transition-[text-decoration-thickness] hover:decoration-[3px] focus-visible:decoration-[3px]';

/** The label in capitals, as on the flyer's top line. */
const label = 'font-sans text-xs font-semibold uppercase tracking-label';

export type ControlSize = 'md' | 'sm' | 'xs';

const CONTROL_BASE =
  'rounded-control border border-line-strong bg-field font-sans text-fg placeholder:text-fg-muted transition-[border-color,background-color,box-shadow] duration-150 hover:not-focus:not-disabled:border-line-bold focus-visible:border-fg focus-visible:bg-field-focus focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:not-focus:shadow-[0_0_0_3px_rgb(156_58_44/22%)]';

/** 17px at least on the public forms: anything smaller makes iOS zoom on focus. */
const CONTROL_SIZES: Record<ControlSize, string> = {
  md: 'block min-h-12 w-full px-4 py-2.5 text-base leading-normal',
  sm: 'block min-h-10 w-full px-3 py-2 text-sm leading-normal',
  /** A select inside a dense admin row. */
  xs: 'inline-block min-h-9 w-auto px-2 py-1.5 text-sm leading-normal',
};

/** Text inputs, textareas and selects. `md` on the public forms, `sm` and `xs` in the admin. */
export const control = (size: ControlSize = 'md'): string => `${CONTROL_BASE} ${CONTROL_SIZES[size]}`;

export const fieldLabel = `mb-2 block text-fg ${label}`;
export const fieldHint = 'mt-1.5 block text-sm text-fg-muted';
/** Written by lib/form.ts; `hidden` until the action rejects the field. Colour is
 *  never the only signal: the message carries a mark of its own. */
export const fieldError =
  'mt-1.5 flex w-fit items-start gap-1.5 rounded-control bg-alert px-2.5 py-1 text-sm font-semibold text-on-alert before:font-bold before:content-["!"]';
export const checkbox = 'mt-1 size-5 shrink-0 cursor-pointer accent-accent';

/** A raised panel: the one place on a block that asks for something (forms). */
export const panel = 'rounded-control border border-line-strong bg-raised p-5 sm:p-8';

/** A quieter frame for rows of a list (admin). */
export const card = 'rounded-control border border-line bg-raised';
