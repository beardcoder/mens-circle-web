import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

import { button, card, control, fieldError, fieldHint, fieldLabel } from '@lib/ui';

import { Icon, type IconName } from './icons';
import type { RegistrationStatus } from './types';
import type { Notice } from './useAdminTask';

export const statusLabel: Record<RegistrationStatus, string> = {
  registered: 'Angemeldet',
  waitlist: 'Warteliste',
  cancelled: 'Storniert',
  attended: 'Teilgenommen',
};

export const holdsSeat = (status: RegistrationStatus) => status === 'registered' || status === 'attended';

export const needsConfirmation = (row: { status: RegistrationStatus; confirmationSentAt: string | null }) =>
  (row.status === 'registered' || row.status === 'waitlist') && !row.confirmationSentAt;

export function shortDate(value: string | null) {
  const date = new Date(value ?? '');

  return Number.isNaN(date.getTime())
    ? '–'
    : new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' }).format(date);
}

export function dateParts(value: string) {
  const date = new Date(value);

  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('de-DE', { ...options, timeZone: 'Europe/Berlin' }).format(date);

  return Number.isNaN(date.getTime())
    ? { day: '–', month: '', weekday: '' }
    : { day: part({ day: 'numeric' }), month: part({ month: 'short' }), weekday: part({ weekday: 'short' }) };
}

export const iconButton =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors duration-180 hover:bg-fg/8 hover:text-fg disabled:pointer-events-none disabled:opacity-50';

export const menuItem =
  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-fg/6 disabled:opacity-50';

export function PageHeader({
  title,
  description,
  back,
  children,
}: {
  title: string;
  description?: ComponentChildren;
  back?: { href: string; label: string };
  children?: ComponentChildren;
}) {
  return (
    <header class="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div class="min-w-0">
        {back && (
          <a
            href={back.href}
            class="mb-3 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors duration-180 hover:text-fg"
          >
            <Icon name="arrowLeft" class="size-4" />
            {back.label}
          </a>
        )}
        <h1 class="text-[clamp(1.75rem,1.4rem+1.4vw,2.5rem)] leading-tight">{title}</h1>
        {description && <p class="mt-1.5 max-w-measure text-sm text-fg-muted">{description}</p>}
      </div>
      {children && <div class="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export type Tone = 'success' | 'accent' | 'muted' | 'danger';

const TONES: Record<Tone, string> = {
  success: 'bg-success/12 text-success',
  accent: 'bg-accent/14 text-accent',
  muted: 'bg-fg/8 text-fg-muted',
  danger: 'bg-danger/14 text-danger',
};

/** A state in words, with a dot: never colour alone. */
export function StatusPill({ tone = 'muted', children }: { tone?: Tone; children: ComponentChildren }) {
  return (
    <span
      class={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONES[tone]}`}
    >
      <span class="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone,
  href,
}: {
  label: string;
  value: ComponentChildren;
  hint?: ComponentChildren;
  icon: IconName;
  tone?: 'accent';
  href?: string;
}) {
  const body = (
    <>
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-fg-muted">{label}</span>
        <span
          class={`grid size-9 place-items-center rounded-full ${tone ? 'bg-accent/14 text-accent' : 'bg-fg/6 text-fg-muted'}`}
        >
          <Icon name={icon} class="size-4.5" />
        </span>
      </div>
      <p class="mt-2 text-[1.5rem] leading-none font-semibold tabular-nums sm:mt-3 sm:text-[1.875rem]">{value}</p>
      {hint && <div class="mt-2 truncate text-sm text-fg-muted">{hint}</div>}
    </>
  );

  const frame = `${card} block p-4 sm:p-5`;

  return href ? (
    <a href={href} class={`${frame} transition-colors duration-180 hover:border-line-bold`}>
      {body}
    </a>
  ) : (
    <div class={frame}>{body}</div>
  );
}

/** Seats taken as a bar; the numbers stand beside it in words. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const share = max > 0 ? Math.min(1, value / max) : 0;

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      class="h-1.5 w-full overflow-hidden rounded-full bg-fg/10"
    >
      <div
        class={`h-full rounded-full ${share >= 1 ? 'bg-success' : 'bg-accent'}`}
        style={{ width: `${share * 100}%` }}
      />
    </div>
  );
}

/** A segmented filter: one pill per view, with its count. */
export function Tabs<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; count?: number }[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} class="flex max-w-full gap-1 overflow-x-auto rounded-full bg-fg/6 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          class="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap text-fg-muted transition-colors duration-180 hover:text-fg disabled:opacity-50 aria-pressed:bg-raised aria-pressed:text-fg"
        >
          {option.label}
          {option.count !== undefined && <span class="text-xs tabular-nums opacity-70">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchField({
  label,
  value,
  placeholder,
  disabled,
  onInput,
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  onInput: (value: string) => void;
}) {
  return (
    <label class="relative block min-w-56 flex-1 sm:max-w-80">
      <span class="sr-only">{label}</span>
      <span class="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-fg-muted">
        <Icon name="search" class="size-4.5" />
      </span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onInput={(event) => onInput(event.currentTarget.value)}
        class={`${control('xs')} w-full pl-11`}
      />
    </label>
  );
}

export function EmptyState({ children, action }: { children: ComponentChildren; action?: ComponentChildren }) {
  return (
    <div class="grid justify-items-center gap-4 border border-dashed border-line-strong px-6 py-12 text-center text-fg-muted">
      <p>{children}</p>
      {action}
    </div>
  );
}

/** An action menu on a native `<details>`; it closes when an item is chosen. */
export function Menu({ label, children }: { label: string; children: ComponentChildren }) {
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = (event: Event) => {
      if (menu.current?.open && !menu.current.contains(event.target as Node)) menu.current.open = false;
    };

    document.addEventListener('click', close);

    return () => document.removeEventListener('click', close);
  }, []);

  return (
    <details ref={menu} class="relative">
      <summary class={`${iconButton} list-none [&::-webkit-details-marker]:hidden`} aria-label={label} title={label}>
        <Icon name="more" />
      </summary>
      <div
        class="absolute right-0 z-20 mt-1 grid min-w-56 border border-line-strong bg-raised py-1.5 shadow-overlay"
        onClick={() => menu.current?.removeAttribute('open')}
      >
        {children}
      </div>
    </details>
  );
}

export function Feedback({ notice }: { notice: Notice | null }) {
  if (!notice) return null;

  return (
    <div
      role={notice.tone === 'error' ? 'alert' : 'status'}
      class={`mb-6 flex items-start gap-3 border-l-2 bg-raised px-4 py-3 text-sm ${notice.tone === 'error' ? 'border-danger text-danger' : notice.tone === 'warning' ? 'border-accent text-fg' : 'border-success text-fg'}`}
    >
      <Icon name={notice.tone === 'success' ? 'check' : 'alert'} class="mt-0.5 size-4.5" />
      <div>
        <p>{notice.text}</p>
        {notice.login && (
          <p class="mt-2">
            <a href="/admin/login" target="_blank" rel="noopener" class="text-accent underline">
              In einem neuen Tab anmelden
            </a>
            . Deine Eingaben bleiben hier erhalten.
          </p>
        )}
      </div>
    </div>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ComponentChildren;
}) {
  return (
    <div class="min-w-0">
      <label for={id} class={fieldLabel}>
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} class={fieldHint}>
          {hint}
        </p>
      )}
      <p id={`${id}-error`} class={fieldError} hidden={!error}>
        {error}
      </p>
    </div>
  );
}

export function ConfirmDialog({
  title,
  children,
  actionLabel,
  busy,
  danger = false,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  children: ComponentChildren;
  actionLabel: string;
  busy: boolean;
  danger?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
    cancel.current?.focus();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-description"
      onCancel={(event) => {
        event.preventDefault();

        if (!busy) onCancel();
      }}
      class="m-auto w-[min(92vw,32rem)] border border-line-strong bg-raised p-6 text-fg shadow-overlay backdrop:bg-black/70 sm:p-8"
    >
      <h2 id="confirm-title" class="font-display text-2xl">
        {title}
      </h2>
      <div id="confirm-description" class="mt-4 grid gap-3 text-sm leading-relaxed text-fg-muted">
        {children}
      </div>
      {error && (
        <p role="alert" class="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
      <div class="mt-6 flex flex-wrap justify-end gap-2">
        <button
          ref={cancel}
          type="button"
          disabled={busy}
          onClick={onCancel}
          class={button({ variant: 'secondary', size: 'sm' })}
        >
          Abbrechen
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          class={button({ variant: danger ? 'danger' : 'primary', size: 'sm' })}
        >
          {busy ? 'Bitte warten …' : actionLabel}
        </button>
      </div>
    </dialog>
  );
}
