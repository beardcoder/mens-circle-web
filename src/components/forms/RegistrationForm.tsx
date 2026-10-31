import { actions, isInputError } from 'astro:actions';
import { useEffect, useRef, useState } from 'preact/hooks';

import { seatFill } from '@lib/seats';
import { button, checkbox, control, fieldError, fieldHint, fieldLabel, formStatus, link } from '@lib/ui';

import type { PublicEvent } from '../event/types';
import { usePublicData } from '../event/usePublicData';

function trackRegistration(name: string, eventId: string): void {
  try {
    window.umami?.track(`event-registration-${name}`, { event_id: eventId });
  } catch {
    // Analytics must never interrupt a registration.
  }
}

export default function RegistrationForm({
  initial,
  contribution,
}: {
  initial: PublicEvent;
  contribution: { main: string; note: string };
}) {
  const { data, error } = usePublicData<PublicEvent>(`/api/public/events/${encodeURIComponent(initial.slug)}`, initial);
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const first = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]');

    first?.focus({ preventScroll: true });
    first?.scrollIntoView({
      block: 'center',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }, [errors]);

  if (data.isPast)
    return (
      <div>
        <h2 id="anmeldung-title" class="text-sub text-fg">
          Dieser Abend hat stattgefunden
        </h2>
        <p class="mt-3 text-md text-fg-soft">Eine Anmeldung ist nicht mehr möglich.</p>
        <a class={`${button()} mt-6`} href="/event#benachrichtigung">
          Termine per E-Mail erhalten
        </a>
      </div>
    );

  if (success)
    return (
      <div role="status">
        <h2 id="anmeldung-title" class="text-sub text-fg">
          Vielen Dank für deine Anmeldung
        </h2>
        <p class="mt-4 text-md text-fg-soft">{success}</p>
      </div>
    );

  return (
    <>
      <RegistrationIntro data={data} contribution={contribution} />
      {error && (
        <p role="status" class="mb-4 text-sm text-fg-muted">
          Der Platzstand lässt sich gerade nicht aktualisieren. Bei der Anmeldung werden die freien Plätze erneut
          geprüft.
        </p>
      )}
      <form
        ref={form}
        method="post"
        noValidate
        autoComplete="on"
        class="grid gap-6"
        onInput={(event) => {
          const target = event.target as HTMLInputElement;

          if (errors[target.name]) setErrors((current) => ({ ...current, [target.name]: '' }));
        }}
        onSubmit={async (event) => {
          event.preventDefault();

          if (busy) return;

          const body = new FormData(event.currentTarget);

          trackRegistration('submit', data.id);

          setBusy(true);
          setMessage('');

          try {
            const result = await actions.register(body);

            if (result.data) {
              trackRegistration('success', data.id);
              setSuccess(result.data.message);
            } else {
              trackRegistration('error', data.id);
              setErrors(
                isInputError(result.error)
                  ? Object.fromEntries(
                      Object.entries(result.error.fields).map(([key, messages]) => [key, messages?.[0] ?? '']),
                    )
                  : {},
              );
              setMessage(isInputError(result.error) ? 'Bitte prüfe die markierten Angaben.' : result.error.message);
            }
          } catch {
            trackRegistration('error', data.id);
            setMessage('Die Anmeldung ist gerade nicht möglich. Bitte versuche es erneut.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} class="grid gap-6 border-0 p-0">
          <legend class="sr-only">Deine Angaben zur Anmeldung</legend>
          <input type="hidden" name="event_id" value={data.id} />
          <div aria-hidden="true" class="absolute -left-[9999px] size-px overflow-hidden">
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <div class="grid gap-5 min-[22.5rem]:grid-cols-2 min-[22.5rem]:gap-4">
            {[
              { name: 'first_name', label: 'Vorname', complete: 'given-name' },
              { name: 'last_name', label: 'Nachname', complete: 'family-name' },
            ].map((field) => (
              <div key={field.name}>
                <label for={`register-${field.name}`} class={fieldLabel}>
                  {field.label}
                </label>
                <input
                  id={`register-${field.name}`}
                  name={field.name}
                  autoComplete={field.complete}
                  required
                  class={control()}
                  aria-invalid={!!errors[field.name] || undefined}
                  aria-describedby={`register-${field.name}-error`}
                />
                <span id={`register-${field.name}-error`} class={fieldError} hidden={!errors[field.name]}>
                  {errors[field.name]}
                </span>
              </div>
            ))}
          </div>
          <div>
            <label for="register-email" class={fieldLabel}>
              E-Mail
            </label>
            <input
              type="email"
              id="register-email"
              name="email"
              required
              autoComplete="email"
              inputMode="email"
              class={control()}
              aria-invalid={!!errors.email || undefined}
              aria-describedby="register-email-error"
            />
            <span id="register-email-error" class={fieldError} hidden={!errors.email}>
              {errors.email}
            </span>
          </div>
          <div>
            <label for="register-phone" class={fieldLabel}>
              Handynummer <span class="font-normal text-fg-muted">(optional)</span>
            </label>
            <input
              type="tel"
              id="register-phone"
              name="phone_number"
              autoComplete="tel"
              inputMode="tel"
              class={control()}
              aria-describedby="register-phone-hint"
            />
            <p id="register-phone-hint" class={fieldHint}>
              Falls wir dich am Veranstaltungstag kurzfristig erreichen müssen.
            </p>
          </div>
          <div>
            <label class="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="privacy"
                required
                class={checkbox}
                aria-invalid={!!errors.privacy || undefined}
                aria-describedby="register-privacy-error"
              />
              <span class="text-base text-fg">
                Ich habe die{' '}
                <a href="/datenschutz" target="_blank" rel="noopener" class={link}>
                  Datenschutzerklärung<span class="sr-only"> (öffnet in neuem Tab)</span>
                </a>{' '}
                gelesen und stimme der Verarbeitung meiner Daten zu.
              </span>
            </label>
            <span id="register-privacy-error" class={fieldError} hidden={!errors.privacy}>
              {errors.privacy}
            </span>
          </div>
          <button type="submit" class={`${button({ size: 'lg', block: true })} mt-2`} disabled={busy}>
            {busy
              ? 'Wird gesendet …'
              : data.view.state === 'full'
                ? 'Auf die Warteliste eintragen'
                : 'Verbindlich anmelden'}
          </button>
        </fieldset>
        {message && (
          <p role="alert" data-tone="error" class={formStatus}>
            {message}
          </p>
        )}
      </form>
    </>
  );
}

function RegistrationIntro({
  data,
  contribution,
}: {
  data: PublicEvent;
  contribution: { main: string; note: string };
}) {
  const fill = seatFill(data.view.seats);

  return (
    <>
      <h2 id="anmeldung-title" class="text-sub text-fg">
        {data.view.state === 'full' ? 'Dein Platz auf der Warteliste' : 'Dein Platz im Kreis'}
      </h2>
      {/* How full the circle is, live: the same bar as under every date. */}
      <div class="mt-4 grid gap-2">
        {fill !== null && (
          <span aria-hidden="true" class="block h-1.5 overflow-hidden rounded-full bg-line">
            <span
              class="block h-full origin-left scale-x-(--fill) rounded-full bg-fill transition-[scale] duration-700 ease-out"
              style={{ '--fill': fill.toFixed(3) }}
            />
          </span>
        )}
        <p role="status" class="text-sm text-fg-muted">
          {data.view.state === 'full'
            ? 'Alle Plätze sind belegt'
            : `${data.availableSpots} von ${data.maxParticipants} Plätzen frei`}
        </p>
      </div>
      <p class="mt-6 mb-6 max-w-measure text-md text-fg-soft">
        {data.view.state === 'full'
          ? 'Dieser Abend ist voll. Du kannst dich auf die Warteliste setzen lassen. Sobald du nachrückst, bekommst du eine E-Mail.'
          : 'Du meldest dich für diesen einzelnen Abend an. Die Bestätigung kommt per E-Mail.'}
      </p>
      <dl class="mb-8 text-sm">
        <div class="flex items-baseline justify-between gap-4">
          <dt class="text-fg-muted">Beitrag</dt>
          <dd class="text-right text-fg">
            {contribution.main}
            {contribution.note && <span class="mt-1 block text-xs text-fg-muted">{contribution.note}</span>}
          </dd>
        </div>
      </dl>
    </>
  );
}
