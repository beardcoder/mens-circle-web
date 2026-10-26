import { actions } from 'astro:actions';
import type { ComponentProps } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

import type { EventInput } from '@lib/event-input';
import { button, card, control, panel } from '@lib/ui';

import { Icon } from './icons';
import type { EventFormData } from './types';
import { ConfirmDialog, Feedback, Field, PageHeader, StatusPill } from './ui';
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
      <EventHeader id={id} slug={slug} />
      {!!event && !event.id && (
        <p class="mb-6 border-l-2 border-accent bg-raised px-4 py-3 text-sm">
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
        class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
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
          document.title = document.title.replace(/^[^·]+/, 'Termin bearbeiten ');
        }}
      >
        <EventFields event={event} errors={task.fields} busy={!!task.busy} editing={!!id} draftSlug={draftSlug} />
        <PublishPanel published={event?.isPublished ?? false} dirty={dirty} saved={saved} busy={!!task.busy} />
      </form>
      {id && <EventNewsletter eventId={id} intro={newsletterIntro} disabled={dirty || !!task.busy} />}
    </>
  );
}

function EventHeader({ id, slug }: { id: string; slug: string }) {
  return (
    <PageHeader
      title={id ? 'Termin bearbeiten' : 'Neuer Termin'}
      description="Termin, Treffpunkt und Veröffentlichung an einem Ort."
      back={{ href: '/admin/events', label: 'Termine' }}
    >
      {id && (
        <a href={`/admin/events/${id}/registrations`} class={button({ variant: 'secondary', size: 'sm' })}>
          <Icon name="users" class="size-4.5" />
          Anmeldungen
        </a>
      )}
      {slug && (
        <a href={`/event/${slug}`} target="_blank" rel="noopener" class={button({ variant: 'secondary', size: 'sm' })}>
          <Icon name="external" class="size-4.5" />
          Öffentliche Seite
        </a>
      )}
    </PageHeader>
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
        <h2 id="event-basics-title" class="font-sans text-lg font-semibold">
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
        <h2 id="event-location-title" class="font-sans text-lg font-semibold">
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
        <h2 id="event-description-title" class="font-sans text-lg font-semibold">
          Beschreibung
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
      </section>
      <details class={`${panel} group`}>
        <summary class="cursor-pointer text-lg font-semibold">Weitere Einstellungen</summary>
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

function PublishPanel({
  published,
  dirty,
  saved,
  busy,
}: {
  published: boolean;
  dirty: boolean;
  saved: boolean;
  busy: boolean;
}) {
  return (
    <>
      <aside class="grid gap-6 lg:sticky lg:top-6" aria-label="Veröffentlichung">
        <section class={`${card} grid gap-4 p-5`} aria-labelledby="event-publish-title">
          <div class="flex items-center justify-between gap-3">
            <h2 id="event-publish-title" class="font-sans text-base font-semibold">
              Veröffentlichung
            </h2>
            <SaveState dirty={dirty} saved={saved} />
          </div>
          <label class="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="isPublished"
              disabled={busy}
              defaultChecked={published}
              class="mt-1 size-5 shrink-0 accent-accent"
            />
            <span class="grid gap-1">
              <strong>Öffentlich sichtbar</strong>
              <span class="text-sm text-fg-muted">
                Nach dem Speichern erscheint der Termin auf der Website. Ohne Haken bleibt er ein Entwurf.
              </span>
            </span>
          </label>
          <div class="grid gap-2 border-t border-line pt-4 max-lg:hidden">
            <SaveButtons dirty={dirty} busy={busy} block />
          </div>
        </section>
      </aside>
      <div class="sticky bottom-20 z-20 flex flex-wrap items-center justify-between gap-3 border border-line-strong bg-raised p-3 shadow-overlay lg:hidden">
        <SaveState dirty={dirty} saved={saved} />
        <div class="flex gap-2">
          <SaveButtons dirty={dirty} busy={busy} />
        </div>
      </div>
    </>
  );
}

function SaveState({ dirty, saved }: { dirty: boolean; saved: boolean }) {
  return (
    <p role="status">
      {dirty ? (
        <StatusPill tone="accent">Ungespeichert</StatusPill>
      ) : saved ? (
        <StatusPill tone="success">Gespeichert</StatusPill>
      ) : (
        <span class="sr-only">Keine Änderungen</span>
      )}
    </p>
  );
}

function SaveButtons({ dirty, busy, block = false }: { dirty: boolean; busy: boolean; block?: boolean }) {
  return (
    <>
      <button type="submit" disabled={busy} class={button({ size: 'sm', block })}>
        {busy ? 'Speichern …' : 'Speichern'}
      </button>
      <button
        type="button"
        disabled={!dirty || busy}
        class={button({ variant: 'secondary', size: 'sm', block })}
        onClick={() => window.location.reload()}
      >
        Verwerfen
      </button>
    </>
  );
}

function EventNewsletter({ eventId, intro, disabled }: { eventId: string; intro: string; disabled: boolean }) {
  const task = useAdminTask();
  const [draft, setDraft] = useState<{ subject: string; intro: string } | null>(null);

  return (
    <details class={`${panel} mt-6 lg:mr-[21.5rem]`}>
      <summary class="cursor-pointer text-lg font-semibold">Per Newsletter ankündigen</summary>
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
            <Icon name="send" class="size-4.5" />
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
