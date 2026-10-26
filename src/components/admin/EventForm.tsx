import { actions } from 'astro:actions';
import type { ComponentProps } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

import type { EventInput } from '@lib/event-input';
import { button, control, panel } from '@lib/ui';

import type { EventFormData } from './types';
import { AdminHead, ConfirmDialog, Feedback, Field } from './ui';
import { useAdminTask } from './useAdminTask';
import { useUnsavedChanges } from './useUnsavedChanges';

type TextField = Exclude<keyof EventInput, 'isPublished'>;

export default function EventForm({ event, newsletterIntro }: { event: EventFormData; newsletterIntro: string }) {
  const initial = event ?? {};
  const [id, setId] = useState(initial.id ?? '');
  const [slug, setSlug] = useState(initial.slug ?? '');
  const [draftSlug, setDraftSlug] = useState(slug);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const task = useAdminTask();

  useUnsavedChanges(dirty);
  useEffect(() => {
    const invalid = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const details = invalid?.closest('details');

    if (details) details.open = true;

    invalid?.focus();
  }, [task.validation]);

  return (
    <>
      <AdminHead
        title={id ? 'Veranstaltung bearbeiten' : 'Neuer Termin'}
        description="Termin, Treffpunkt und Veröffentlichung an einem Ort."
      >
        <a href="/admin" class={button({ variant: 'secondary', size: 'sm' })}>
          Zur Übersicht
        </a>
        {id && (
          <a href={`/admin/events/${id}/registrations`} class={button({ variant: 'secondary', size: 'sm' })}>
            Anmeldungen
          </a>
        )}
        {slug && (
          <a
            href={`/event/${slug}`}
            target="_blank"
            rel="noopener"
            class={button({ variant: 'secondary', size: 'sm' })}
          >
            Öffentliche Seite öffnen
          </a>
        )}
      </AdminHead>
      {!!event && !event.id && (
        <p class="mb-6 border-l-2 border-accent bg-raised p-4 text-sm">
          Vorlage übernommen. Bitte Datum setzen und die Veröffentlichung prüfen.
        </p>
      )}
      <Feedback notice={task.notice} />
      <form
        ref={form}
        id="admin-event-form"
        method="post"
        noValidate
        data-unsaved={dirty ? 'true' : undefined}
        class="grid gap-6"
        onInput={(event) => {
          setDirty(true);
          setSaved(false);
          const input = event.target as HTMLInputElement;

          if (input.name === 'slug') setDraftSlug(input.value);

          task.clearField(input.name);
        }}
        onSubmit={async (event) => {
          event.preventDefault();
          const body = new FormData(event.currentTarget);

          if (id) body.set('id', id);

          const result = await task.run('save', () => actions.saveEvent(body));

          if (!result) return;

          setId(result.id);
          setSlug(result.slug);
          setDraftSlug(result.slug);
          setDirty(false);
          setSaved(true);
          window.history.replaceState(null, '', `/admin/events/${result.id}`);
          document.title = 'Veranstaltung bearbeiten · Admin · Männerkreis';
        }}
      >
        <EventFields event={event} errors={task.fields} busy={!!task.busy} editing={!!id} draftSlug={draftSlug} />
        <SaveBar dirty={dirty} saved={saved} busy={!!task.busy} />
      </form>
      {id && <EventNewsletter eventId={id} intro={newsletterIntro} disabled={dirty || !!task.busy} />}
    </>
  );
}

function EventFields({
  event,
  errors,
  busy,
  editing,
  draftSlug,
}: {
  event: EventFormData;
  errors: Record<string, string>;
  busy: boolean;
  editing: boolean;
  draftSlug: string;
}) {
  const value = event ?? {};

  function input(name: TextField, label: string, options: ComponentProps<'input'> & { hint?: string } = {}) {
    const { hint, ...attributes } = options;
    const fallback = name === 'maxParticipants' ? '8' : '';
    const current = String(value[name] ?? fallback);

    return (
      <Field id={`event-${name}`} label={label} hint={hint} error={errors[name]}>
        <input
          id={`event-${name}`}
          name={name}
          type="text"
          {...(name === 'slug'
            ? { value: draftSlug }
            : { defaultValue: name === 'eventDate' ? current.slice(0, 10) : current })}
          class={control('sm')}
          aria-invalid={!!errors[name] || undefined}
          aria-describedby={`event-${name}-hint event-${name}-error`}
          {...attributes}
        />
      </Field>
    );
  }

  return (
    <fieldset disabled={busy} class="grid min-w-0 gap-6 border-0 p-0">
      <legend class="sr-only">Veranstaltung bearbeiten</legend>
      <section class={`${panel} grid gap-5`} aria-labelledby="event-basics-title">
        <h2 id="event-basics-title" class="text-xl font-semibold">
          Termin und Plätze
        </h2>
        {input('title', 'Titel', { required: true, placeholder: 'Männerkreis in Straubing' })}
        <div class="grid gap-5 sm:grid-cols-3">
          {input('eventDate', 'Datum', { type: 'date', required: true })}
          {input('startTime', 'Beginn', { type: 'time' })}
          {input('endTime', 'Ende', { type: 'time' })}
        </div>
        <div class="grid gap-5 sm:grid-cols-[10rem_1fr]">
          {input('maxParticipants', 'Teilnehmerplätze', { type: 'number', min: 1, step: 1 })}
          {input('costBasis', 'Teilnahmebeitrag', {
            placeholder: 'Auf Spendenbasis',
            hint: 'Dieser Text steht öffentlich beim Termin.',
          })}
        </div>
      </section>
      <section class={`${panel} grid gap-5`} aria-labelledby="event-location-title">
        <h2 id="event-location-title" class="text-xl font-semibold">
          Treffpunkt
        </h2>
        {input('location', 'Name des Ortes')}
        <div class="grid gap-5 sm:grid-cols-[1fr_8rem_1fr]">
          {input('street', 'Straße und Hausnummer')}
          {input('postalCode', 'Postleitzahl')}
          {input('city', 'Stadt')}
        </div>
        <Field
          id="event-locationDetails"
          label="Hinweis zur Anreise"
          hint="Zum Beispiel Eingang, Parkmöglichkeit oder genauer Treffpunkt."
          error={errors.locationDetails}
        >
          <textarea
            id="event-locationDetails"
            name="locationDetails"
            rows={3}
            defaultValue={value.locationDetails ?? ''}
            class={`${control('sm')} resize-y`}
          />
        </Field>
      </section>
      <section class={`${panel} grid gap-5`} aria-labelledby="event-description-title">
        <h2 id="event-description-title" class="text-xl font-semibold">
          Beschreibung und Sichtbarkeit
        </h2>
        <Field
          id="event-description"
          label="Beschreibung des Abends"
          hint="Leerzeilen trennen Absätze. Listen beginnen mit einem Bindestrich."
          error={errors.description}
        >
          <textarea
            id="event-description"
            name="description"
            rows={7}
            defaultValue={value.description ?? ''}
            class={`${control('sm')} resize-y`}
          />
        </Field>
        <label class="flex cursor-pointer items-start gap-3 border-t border-line pt-5">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={value.isPublished ?? false}
            class="mt-1 size-5 accent-accent"
          />
          <span class="grid gap-1">
            <strong>Öffentlich sichtbar</strong>
            <span class="text-sm text-fg-muted">
              Nach dem Speichern erscheint dieser Termin auf der Website. Ohne Haken bleibt er ein Entwurf.
            </span>
          </span>
        </label>
      </section>
      <details class={`${panel} group`}>
        <summary class="cursor-pointer font-semibold">Weitere Einstellungen</summary>
        <div class="mt-5 grid gap-5">
          {input('slug', 'Adresse der Terminseite', {
            hint: editing
              ? 'Leer lassen: die bestehende Adresse bleibt erhalten.'
              : 'Leer lassen: wird automatisch aus dem Datum erzeugt.',
            placeholder: '2026-11-12',
          })}
          {input('imageUrl', 'Zusätzliches Veranstaltungsbild', { type: 'url', placeholder: 'https://…' })}
          <div class="grid gap-5 sm:grid-cols-2">
            {input('latitude', 'Breitengrad', { type: 'number', step: 'any' })}
            {input('longitude', 'Längengrad', { type: 'number', step: 'any' })}
          </div>
        </div>
      </details>
    </fieldset>
  );
}

function SaveBar({ dirty, saved, busy }: { dirty: boolean; saved: boolean; busy: boolean }) {
  return (
    <div class="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 border border-line-strong bg-ground/95 p-4 shadow-overlay backdrop-blur-sm">
      <p role="status" class={`text-sm ${dirty ? 'text-accent' : 'text-fg-muted'}`}>
        {dirty ? 'Ungespeicherte Änderungen' : saved ? 'Alle Änderungen gespeichert.' : 'Bereit zum Bearbeiten'}
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!dirty || busy}
          class={button({ variant: 'secondary', size: 'sm' })}
          onClick={() => window.location.reload()}
        >
          Verwerfen
        </button>
        <button type="submit" disabled={busy} class={button({ size: 'sm' })}>
          {busy ? 'Speichern …' : 'Änderungen speichern'}
        </button>
      </div>
    </div>
  );
}

function EventNewsletter({ eventId, intro, disabled }: { eventId: string; intro: string; disabled: boolean }) {
  const task = useAdminTask();
  const [draft, setDraft] = useState<{ subject: string; intro: string } | null>(null);

  return (
    <details class="mt-10 border-t border-line pt-6">
      <summary class="cursor-pointer text-xl font-semibold">Diesen Termin per Newsletter ankündigen</summary>
      <p class="mt-3 max-w-measure text-sm text-fg-muted">
        Geht an den öffentlichen Newsletter-Verteiler. Datum, Treffpunkt und Anmeldelink werden aus dem gespeicherten
        Termin ergänzt.
      </p>
      {disabled && <p class="mt-3 text-sm text-accent">Speichere zuerst deine Änderungen am Termin.</p>}
      <Feedback notice={task.notice} />
      <form
        class="mt-5 grid gap-5"
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          const body = new FormData(event.currentTarget);

          task.setNotice(null);
          setDraft({ subject: String(body.get('subject') ?? ''), intro: String(body.get('intro') ?? '') });
        }}
      >
        <fieldset disabled={disabled || !!task.busy} class="grid gap-5 border-0 p-0">
          <Field id="newsletter-subject" label="Betreff">
            <input
              id="newsletter-subject"
              name="subject"
              required
              defaultValue="Einladung zum nächsten Männerkreis"
              class={control('sm')}
            />
          </Field>
          <Field id="newsletter-intro" label="Einleitung">
            <textarea
              id="newsletter-intro"
              name="intro"
              rows={8}
              defaultValue={intro}
              class={`${control('sm')} resize-y`}
            />
          </Field>
          <button class={`${button({ variant: 'secondary', size: 'sm' })} justify-self-start`} type="submit">
            Versand prüfen
          </button>
        </fieldset>
      </form>
      {draft && (
        <ConfirmDialog
          title="Newsletter versenden?"
          actionLabel="An Newsletter-Verteiler senden"
          busy={!!task.busy}
          error={task.notice?.tone === 'error' ? task.notice.text : undefined}
          onCancel={() => setDraft(null)}
          onConfirm={async () => {
            const result = await task.run('newsletter', () => actions.sendEventNewsletter({ id: eventId, ...draft }));

            if (result) setDraft(null);
          }}
        >
          <p>Empfänger: alle Abonnenten des öffentlichen Newsletter-Verteilers.</p>
          <p class="text-fg">
            <strong>Betreff:</strong> {draft.subject}
          </p>
          <p class="max-h-48 overflow-auto whitespace-pre-wrap">{draft.intro}</p>
        </ConfirmDialog>
      )}
    </details>
  );
}
