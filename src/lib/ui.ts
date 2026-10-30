/**
 * Class recipes of the design system — complete, static Tailwind class strings, so
 * Tailwind finds every class and components never assemble fragments. The `.astro`
 * components in `src/components/ui/` wrap these; the admin uses them directly.
 * See docs/design-system.md.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

/** One shape for every button: fully round, the label in normal case at weight 600. On hover it changes colour and rises 2px; pressed, it settles. */
const BUTTON_BASE =
  'group/btn relative inline-flex items-center justify-center rounded-full border text-center font-sans font-semibold leading-tight no-underline transition-[background-color,color,border-color,box-shadow,translate,scale] duration-180 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [@media(hover:hover)]:hover:-translate-y-0.5 motion-reduce:active:scale-100 motion-reduce:[@media(hover:hover)]:hover:translate-y-0';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  /** The one main action of a module: ember under a light label, glowing a little on hover. */
  primary:
    'border-transparent bg-fill text-on-fill hover:bg-fill-strong [@media(hover:hover)]:hover:shadow-[0_10px_24px_-12px_var(--color-fill)]',
  /** A further action beside it: outlined in the control colour. */
  secondary: 'border-line-bold bg-transparent text-fg hover:border-fg hover:bg-fg/6',
  danger: 'border-danger bg-transparent text-danger hover:bg-danger hover:text-surface',
};

/** Heights and text sizes are shared with the fields (`CONTROL_SIZES`), so a field and its button stand as one row. */
const BUTTON_SIZES: Record<ButtonSize, string> = {
  /** The admin's dense row buttons: still well clear of the 24px minimum target. */
  xs: 'min-h-9 gap-1.5 px-4 py-1.5 text-sm',
  /** The header's action, the admin's field rows. */
  sm: 'min-h-11 gap-2 px-5 py-2 text-[0.9375rem]',
  md: 'min-h-12 gap-2 px-6 py-3 text-base',
  lg: 'min-h-13 gap-2.5 px-8 py-3.5 text-base',
};

export const button = ({
  variant = 'primary',
  size = 'md',
  block = false,
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean } = {}): string =>
  [BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], block ? 'w-full' : ''].filter(Boolean).join(' ');

/** A link inside running text: the accent, underlined. */
export const link =
  'text-accent underline decoration-1 underline-offset-[3px] transition-colors duration-180 hover:text-accent-strong';

type ControlSize = 'md' | 'sm' | 'xs';

/**
 * Fields share the buttons' heights, outline, focus and motion, in a softer shape:
 * rounded corners (`md`), so a textarea and an input look alike; the control
 * outline, the site's focus outline.
 */
const CONTROL_BASE =
  'rounded-md border border-line-bold bg-field font-sans text-fg placeholder:text-fg-muted transition-[border-color,background-color] duration-180 ease-out hover:not-focus:not-disabled:border-fg focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger';

/** The buttons' heights and text sizes; 16px at least on the public forms, anything smaller makes iOS zoom on focus. */
const CONTROL_SIZES: Record<ControlSize, string> = {
  md: 'block min-h-12 w-full px-4 py-2.5 text-base leading-normal',
  sm: 'block min-h-11 w-full px-3.5 py-2 text-[0.9375rem] leading-normal',
  /** A select inside a dense admin row. */
  xs: 'inline-block min-h-9 w-auto px-3 py-1.5 text-sm leading-normal',
};

/** Text inputs, textareas and selects: one family everywhere. `md` on the public forms, `sm` and `xs` in the admin. */
export const control = (size: ControlSize = 'md'): string => `${CONTROL_BASE} ${CONTROL_SIZES[size]}`;

/** A field's label: always visible, above its control. */
export const fieldLabel = 'mb-2 block text-sm font-semibold text-fg';
export const fieldHint = 'mt-2 block text-sm text-fg-muted';

/** Written by lib/form.ts; `hidden` until the action rejects the field. Colour is
 *  never the only signal: the message carries a mark of its own. */
export const fieldError =
  'mt-2 flex items-start gap-2 text-sm font-medium text-danger before:mt-px before:grid before:size-4.5 before:shrink-0 before:place-items-center before:rounded-full before:bg-danger before:text-[0.6875rem] before:leading-none before:font-bold before:text-surface before:content-["!"]';

/** A form's own answer under its button, written by lib/form.ts: what actually happened, in words, with a mark. */
export const formStatus =
  'flex items-start gap-2 text-base font-medium before:mt-0.5 before:grid before:size-5 before:shrink-0 before:place-items-center before:rounded-full before:text-xs before:leading-none before:font-bold before:text-surface data-[tone=error]:text-danger data-[tone=error]:before:bg-danger data-[tone=error]:before:content-["!"] data-[tone=success]:text-success data-[tone=success]:before:bg-success data-[tone=success]:before:content-["✓"]';

export const checkbox = 'mt-0.5 size-5 shrink-0 cursor-pointer accent-fill';

/** A short label over data or a group: sentence case in the secondary text colour. */
export const label = 'font-sans text-sm font-semibold text-fg-muted';

/** A card: a self-contained module (a date, a form). Rounded, raised a little off the page. */
export const card = 'rounded-xl border border-line bg-raised shadow-card';

/**
 * A large card's padding (a form, the quote). On phones it reaches out to a sheet's
 * inset, so what it holds keeps the page's edge instead of a second indent.
 */
export const panelPadding = 'p-panel max-sm:-mx-sheet max-sm:px-sheet';

/** A card with its padding, for the cards that hold a form (the admin's panels). */
export const panel = `${card} p-card`;
