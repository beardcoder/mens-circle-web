import { actions } from 'astro:actions';
import { useEffect, useState } from 'preact/hooks';

import { button, card, control } from '@lib/ui';

import { Icon } from './icons';
import type { Testimonial } from './types';
import {
  ConfirmDialog,
  EmptyState,
  Feedback,
  Field,
  iconButton,
  PageHeader,
  SearchField,
  shortDate,
  StatusPill,
  Tabs,
} from './ui';
import { useAdminTask } from './useAdminTask';
import { useUnsavedChanges } from './useUnsavedChanges';

export default function TestimonialModerator({ initial }: { initial: Testimonial[] }) {
  const [rows, setRows] = useState(initial);

  const [filter, setFilter] = useState<'pending' | 'published' | 'all'>(
    initial.some((row) => !row.isPublished) ? 'pending' : 'all',
  );

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ row: Testimonial; kind: 'delete' | 'publish' } | null>(null);
  const task = useAdminTask();
  const pending = rows.filter((row) => !row.isPublished).length;

  const visible = rows
    .filter((row) => filter === 'all' || row.isPublished === (filter === 'published'))
    .filter((row) =>
      `${row.authorName} ${row.email} ${row.quote}`.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt));

  function patch(id: string, value: Partial<Testimonial>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...value } : row)));
  }

  return (
    <>
      <PageHeader title="Stimmen" description="Eingereichte Erfahrungen prüfen, bearbeiten und freigeben.">
        <button
          type="button"
          disabled={!!task.busy || !!editing}
          class={button({ variant: 'secondary', size: 'sm' })}
          onClick={() =>
            void task.run(
              'refresh',
              () => actions.loadAdminTestimonials(),
              (data) => setRows(data.testimonials),
            )
          }
        >
          <Icon name="refresh" class="size-4.5" />
          Aktualisieren
        </button>
      </PageHeader>
      <Feedback notice={task.notice} />
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Nach Status filtern"
          value={filter}
          disabled={!!editing}
          onChange={setFilter}
          options={[
            { value: 'pending', label: 'Zur Prüfung', count: pending },
            { value: 'published', label: 'Veröffentlicht', count: rows.length - pending },
            { value: 'all', label: 'Alle', count: rows.length },
          ]}
        />
        <SearchField
          label="Stimmen durchsuchen"
          placeholder="Name, E-Mail oder Text"
          disabled={!!editing}
          value={search}
          onInput={setSearch}
        />
      </div>
      {editing && (
        <p class="mb-4 text-sm text-accent">
          Bearbeitung geöffnet. Speichern oder abbrechen, um die Filter wieder zu ändern.
        </p>
      )}
      {!visible.length && (
        <EmptyState>{rows.length ? 'Keine Stimmen für diese Auswahl.' : 'Noch keine Einreichungen.'}</EmptyState>
      )}
      <ul class="grid gap-4" aria-label="Teilnehmerstimmen">
        {visible.map((row) => (
          <TestimonialCard
            key={row.id}
            row={row}
            editing={editing === row.id}
            disabled={!!task.busy || (!!editing && editing !== row.id)}
            errors={task.fields}
            onEdit={() => {
              task.setNotice(null);
              setEditing(row.id);
            }}
            onCancel={() => setEditing(null)}
            onSave={async (value) => {
              const result = await task.run(row.id, () => actions.updateTestimonial({ id: row.id, ...value }));

              if (result) {
                patch(row.id, value);
                setEditing(null);
              }
            }}
            onOrder={(sortOrder) =>
              void task.run(
                `order-${row.id}`,
                () => actions.moderateTestimonial({ id: row.id, sortOrder }),
                () => patch(row.id, { sortOrder }),
              )
            }
            onPublish={() => {
              task.setNotice(null);

              if (!row.isPublished) {
                setConfirm({ row, kind: 'publish' });

                return;
              }

              void task.run(
                row.id,
                () => actions.moderateTestimonial({ id: row.id, publish: false }),
                () => patch(row.id, { isPublished: false }),
              );
            }}
            onRemove={() => {
              task.setNotice(null);
              setConfirm({ row, kind: 'delete' });
            }}
          />
        ))}
      </ul>
      <p class="mt-5 max-w-measure text-sm text-fg-muted">
        E-Mail-Adressen bleiben intern. Bereits geöffnete öffentliche Seiten können noch die vorherige Fassung einer
        Stimme anzeigen.
      </p>
      {confirm && (
        <ModerationDialog
          value={confirm}
          task={task}
          onCancel={() => setConfirm(null)}
          onDelete={() => setRows((current) => current.filter((row) => row.id !== confirm.row.id))}
          onPublish={() => patch(confirm.row.id, { isPublished: true })}
        />
      )}
    </>
  );
}

type TestimonialEdit = Pick<Testimonial, 'quote' | 'authorName' | 'role' | 'email'>;

function TestimonialCard({
  row,
  editing,
  disabled,
  errors,
  onEdit,
  onCancel,
  onSave,
  onOrder,
  onPublish,
  onRemove,
}: {
  row: Testimonial;
  editing: boolean;
  disabled: boolean;
  errors: Record<string, string>;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (value: TestimonialEdit) => Promise<void>;
  onOrder: (value: number) => void;
  onPublish: () => void;
  onRemove: () => void;
}) {
  const [order, setOrder] = useState(String(row.sortOrder));
  const [dirty, setDirty] = useState(false);

  useUnsavedChanges(editing && dirty);
  useEffect(() => setOrder(String(row.sortOrder)), [row.sortOrder]);
  useEffect(() => {
    if (!editing) setDirty(false);
  }, [editing]);

  return (
    <li class={`${card} p-5 sm:p-6`}>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <StatusPill tone={row.isPublished ? 'success' : 'accent'}>
          {row.isPublished ? 'Veröffentlicht' : 'Zur Prüfung'}
        </StatusPill>
        <span class="text-xs text-fg-muted">Eingereicht {shortDate(row.createdAt)}</span>
      </div>
      {editing ? (
        <TestimonialEditor
          row={row}
          disabled={disabled}
          errors={errors}
          dirty={dirty}
          onInput={() => setDirty(true)}
          onCancel={onCancel}
          onSave={onSave}
        />
      ) : (
        <>
          <blockquote class="max-w-[48rem] font-display text-lg leading-relaxed whitespace-pre-wrap">
            „{row.quote}“
          </blockquote>
          <p class="mt-3 min-w-0 text-sm break-words text-fg-muted">
            <strong class="text-fg">{row.authorName || 'Ohne Namensangabe'}</strong>
            {row.role && ` · ${row.role}`}
            {row.email && (
              <>
                {' · '}
                <a href={`mailto:${row.email}`} class="hover:text-accent">
                  {row.email}
                </a>
              </>
            )}
          </p>
          <div class="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <form
              class="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                onOrder(Number(order) || 0);
              }}
            >
              <label for={`order-${row.id}`} class="text-sm text-fg-muted">
                Reihenfolge
              </label>
              <input
                id={`order-${row.id}`}
                name="sortOrder"
                type="number"
                value={order}
                onInput={(event) => setOrder(event.currentTarget.value)}
                disabled={disabled}
                class={`${control('xs')} max-w-24`}
              />
              {Number(order) !== row.sortOrder && (
                <button type="submit" disabled={disabled} class={button({ variant: 'secondary', size: 'xs' })}>
                  Übernehmen
                </button>
              )}
            </form>
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={onEdit}
                class={iconButton}
                aria-label="Bearbeiten"
                title="Bearbeiten"
              >
                <Icon name="edit" class="size-4.5" />
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={onRemove}
                class={`${iconButton} hover:text-danger`}
                aria-label="Löschen"
                title="Löschen"
              >
                <Icon name="trash" class="size-4.5" />
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={onPublish}
                class={button({ variant: row.isPublished ? 'secondary' : 'primary', size: 'xs' })}
              >
                <Icon name={row.isPublished ? 'eyeOff' : 'check'} class="size-4" />
                {row.isPublished ? 'Verbergen' : 'Freigeben'}
              </button>
            </div>
          </div>
        </>
      )}
    </li>
  );
}

function TestimonialEditor({
  row,
  disabled,
  dirty,
  errors,
  onInput,
  onCancel,
  onSave,
}: {
  row: Testimonial;
  disabled: boolean;
  dirty: boolean;
  errors: Record<string, string>;
  onInput: () => void;
  onCancel: () => void;
  onSave: (value: TestimonialEdit) => Promise<void>;
}) {
  return (
    <form
      method="post"
      data-unsaved={dirty ? 'true' : undefined}
      class="grid gap-4"
      onInput={onInput}
      onSubmit={async (event) => {
        event.preventDefault();
        const body = new FormData(event.currentTarget);
        const text = (name: string) => String(body.get(name) ?? '').trim();

        await onSave({
          quote: text('quote'),
          authorName: text('authorName'),
          role: text('role'),
          email: text('email'),
        });
      }}
    >
      <fieldset disabled={disabled} class="grid gap-4 border-0 p-0">
        {row.isPublished && (
          <p class="text-sm text-accent">
            Diese Stimme ist veröffentlicht. Speichern aktualisiert auch die öffentliche Fassung.
          </p>
        )}
        <Field id={`quote-${row.id}`} label="Zitat" error={errors.quote}>
          <textarea
            id={`quote-${row.id}`}
            name="quote"
            required
            rows={6}
            defaultValue={row.quote}
            class={`${control('sm')} resize-y`}
          />
        </Field>
        <div class="grid gap-4 sm:grid-cols-2">
          <Field id={`author-${row.id}`} label="Name">
            <input id={`author-${row.id}`} name="authorName" defaultValue={row.authorName} class={control('sm')} />
          </Field>
          <Field id={`role-${row.id}`} label="Rolle">
            <input id={`role-${row.id}`} name="role" defaultValue={row.role} class={control('sm')} />
          </Field>
        </div>
        <Field id={`email-${row.id}`} label="E-Mail (intern)">
          <input id={`email-${row.id}`} name="email" type="email" defaultValue={row.email} class={control('sm')} />
        </Field>
        <div class="flex flex-wrap gap-2">
          <button type="submit" class={button({ size: 'sm' })}>
            Änderungen speichern
          </button>
          <button type="button" onClick={onCancel} class={button({ variant: 'secondary', size: 'sm' })}>
            Abbrechen
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function ModerationDialog({
  value,
  task,
  onCancel,
  onDelete,
  onPublish,
}: {
  value: { row: Testimonial; kind: 'delete' | 'publish' };
  task: ReturnType<typeof useAdminTask>;
  onCancel: () => void;
  onDelete: () => void;
  onPublish: () => void;
}) {
  const removing = value.kind === 'delete';

  return (
    <ConfirmDialog
      title={removing ? 'Stimme löschen?' : 'Stimme veröffentlichen?'}
      actionLabel={removing ? 'Stimme löschen' : 'Jetzt veröffentlichen'}
      danger={removing}
      busy={!!task.busy}
      error={task.notice?.tone === 'error' ? task.notice.text : undefined}
      onCancel={onCancel}
      onConfirm={async () => {
        const result = removing
          ? await task.run('delete', () => actions.deleteTestimonial({ id: value.row.id }), onDelete)
          : await task.run(
              'publish',
              () => actions.moderateTestimonial({ id: value.row.id, publish: true }),
              onPublish,
            );

        if (result) onCancel();
      }}
    >
      <blockquote class="max-h-56 overflow-auto whitespace-pre-wrap text-fg">„{value.row.quote}“</blockquote>
      <p>
        {value.row.authorName || 'Ohne Namensangabe'}
        {value.row.role && ` · ${value.row.role}`}
      </p>
      <p>
        {removing
          ? 'Die Stimme wird aus der Übersicht und von der öffentlichen Website entfernt.'
          : 'Zitat, Name und Rolle werden öffentlich sichtbar. Die E-Mail-Adresse bleibt intern.'}
      </p>
    </ConfirmDialog>
  );
}
