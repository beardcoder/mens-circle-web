import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

import { button, fieldError, fieldHint, fieldLabel } from '@lib/ui';

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

export function AdminHead({
  title,
  children,
  description,
}: {
  title: string;
  children?: ComponentChildren;
  description?: string;
}) {
  return (
    <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-serif text-[clamp(2rem,1.4rem+2.4vw,3rem)] leading-tight tracking-display">{title}</h1>
        {description && <p class="mt-2 max-w-measure text-sm text-fg-muted">{description}</p>}
      </div>
      <div class="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Badge({ children, active = false }: { children: ComponentChildren; active?: boolean }) {
  return (
    <span
      class={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${active ? 'border-success/40 text-success' : 'border-line-strong text-fg-muted'}`}
    >
      {children}
    </span>
  );
}

export function Feedback({ notice }: { notice: Notice | null }) {
  if (!notice) return null;

  return (
    <div
      role={notice.tone === 'error' ? 'alert' : 'status'}
      class={`my-4 border-l-2 bg-raised px-4 py-3 text-sm ${notice.tone === 'error' ? 'border-danger text-danger' : notice.tone === 'warning' ? 'border-accent text-fg' : 'border-success text-fg'}`}
    >
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
      <h2 id="confirm-title" class="font-serif text-2xl">
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
