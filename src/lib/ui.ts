/**
 * Class recipes of the design system — complete, static Tailwind class strings, so
 * Tailwind finds every class and components never assemble fragments. The `.astro`
 * components in `src/components/ui/` wrap these; the admin uses them directly.
 * See docs/design-system.md.
 */

export type ButtonVariant = 'primary' | 'secondary'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

/** One shape for every button: fully round, the label in normal case at weight 600. On hover it changes colour and rises 2px; pressed, it settles. */
const BUTTON_BASE
  = 'group/btn relative inline-flex items-center justify-center rounded-full border text-center font-sans font-semibold leading-tight no-underline transition-[background-color,color,border-color,translate,scale] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [@media(hover:hover)]:hover:-translate-y-0.5 motion-reduce:active:scale-100 motion-reduce:[@media(hover:hover)]:hover:translate-y-0'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  /** The one main action of a module: the accent under an ink label, a shade lighter under the pointer. */
  primary:
    'border-transparent bg-accent text-on-accent hover:bg-accent-strong',
  /** A further action beside it: outlined in the control colour. */
  secondary: 'border-line-bold bg-transparent text-fg hover:border-fg hover:bg-fg/6',
}

/** Heights and text sizes are shared with the fields (`CONTROL_SIZES`), so a field and its button stand as one row. */
const BUTTON_SIZES: Record<ButtonSize, string> = {
  /** The admin's dense row buttons: still well clear of the 24px minimum target. */
  xs: 'min-h-9 gap-1.5 px-4 py-1.5 text-sm',
  /** The header's action, the admin's field rows. */
  sm: 'min-h-11 gap-2 px-5 py-2 text-[0.9375rem]',
  md: 'min-h-12 gap-2 px-6 py-3 text-base',
  lg: 'min-h-13 gap-2.5 px-8 py-3.5 text-base',
}

export const button = ({
  variant = 'primary',
  size = 'md',
  block = false,
}: { variant?: ButtonVariant, size?: ButtonSize, block?: boolean } = {}): string =>
  [BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], block ? 'w-full' : ''].filter(Boolean).join(' ')

/** A link inside running text: the text's own colour on an accent underline. */
export const link
  = 'text-fg underline decoration-accent decoration-2 underline-offset-4 transition-colors duration-180 hover:decoration-fg'

type ControlSize = 'md' | 'sm' | 'xs'

/**
 * Fields share the buttons' heights, outline, focus and motion, in a softer shape:
 * rounded corners (`md`), so a textarea and an input look alike; the control
 * outline, the site's focus outline.
 */
const CONTROL_BASE
  = 'rounded-md border border-line-bold bg-transparent font-sans text-fg placeholder:text-fg-muted transition-[border-color,background-color] duration-180 ease-out hover:not-focus:not-disabled:border-fg focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger'

/** The buttons' heights and text sizes; 16px at least on the public forms, anything smaller makes iOS zoom on focus. */
const CONTROL_SIZES: Record<ControlSize, string> = {
  md: 'block min-h-12 w-full px-4 py-2.5 text-base leading-normal',
  sm: 'block min-h-11 w-full px-3.5 py-2 text-[0.9375rem] leading-normal',
  /** A select inside a dense admin row. */
  xs: 'inline-block min-h-9 w-auto px-3 py-1.5 text-sm leading-normal',
}

/** Text inputs, textareas and selects: one family everywhere. `md` on the public forms, `sm` and `xs` in the admin. */
export const control = (size: ControlSize = 'md'): string => `${CONTROL_BASE} ${CONTROL_SIZES[size]}`

/** A field's label: always visible, above its control. */
export const fieldLabel = 'mb-2 block text-sm font-semibold text-fg'
export const fieldHint = 'mt-2 block text-sm text-fg-muted'

/** Written by lib/form.ts; `hidden` until the action rejects the field. Colour is
 *  never the only signal: the message carries a mark of its own. It arrives: 4px up
 *  and in, 200ms (`@starting-style`), so an answer does not pop into the form. */
export const fieldError
  = 'mt-2 flex items-start gap-2 text-sm font-medium text-danger transition-[opacity,translate,display] transition-discrete duration-200 ease-out starting:translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0 before:mt-px before:grid before:size-4.5 before:shrink-0 before:place-items-center before:rounded-full before:bg-danger before:text-[0.6875rem] before:leading-none before:font-bold before:text-surface before:content-["!"]'

/** A form's own answer under its button, written by lib/form.ts: what actually happened, in words, with a mark. */
export const formStatus
  = 'flex items-start gap-2 text-base font-medium transition-[opacity,translate,display] transition-discrete duration-200 ease-out starting:translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0 before:mt-0.5 before:grid before:size-5 before:shrink-0 before:place-items-center before:rounded-full before:text-xs before:leading-none before:font-bold before:text-surface data-[tone=error]:text-danger data-[tone=error]:before:bg-danger data-[tone=error]:before:content-["!"] data-[tone=success]:text-fg data-[tone=success]:before:bg-fg data-[tone=success]:before:content-["✓"]'

export const checkbox = 'mt-0.5 size-5 shrink-0 cursor-pointer accent-accent'

/** A short label over data or a group: sentence case in the secondary text colour. */
export const label = 'font-sans text-sm font-semibold text-fg-muted'

/**
 * The margin column, the first of the four moves (docs/design-system.md): from `lg`
 * a margin on columns 1–3 for what labels the content (an index number, a note, the
 * labels of data) beside the content on 4–12. A title may start in the margin and
 * run into the content (`cross`, columns 1–10), crossing the line between them.
 * Below `lg` everything stacks, the margin first. Always on the left.
 */
export const margin = {
  /** The grid itself: one column, twelve from `lg`. */
  grid: 'grid grid-cols-1 gap-x-grid lg:grid-cols-12',
  /** The margin: columns 1–3. */
  side: 'min-w-0 lg:col-span-3',
  /** The content: columns 4–12. */
  content: 'min-w-0 lg:col-span-9 lg:col-start-4',
  /** A reading column in the content: columns 4–10, about a line of running text. */
  reading: 'min-w-0 lg:col-span-7 lg:col-start-4',
  /** A title that starts in the margin and crosses into the content: columns 1–10. */
  cross: 'min-w-0 lg:col-span-10',
} as const
