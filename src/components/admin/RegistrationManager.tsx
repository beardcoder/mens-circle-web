import { actions } from 'astro:actions';
import { useState } from 'preact/hooks';

import { button, card, control } from '@lib/ui';

import type { RegistrationRow, RegistrationsData, RegistrationStatus } from './types';
import { AdminHead, Badge, ConfirmDialog, Feedback, holdsSeat, needsConfirmation, shortDate, statusLabel } from './ui';
import { useAdminTask } from './useAdminTask';

interface Command {
  title: string;
  description: string;
  actionLabel: string;
  danger?: boolean;
  request: () => ReturnType<typeof actions.deleteRegistration>;
}

export default function RegistrationManager({ initial }: { initial: RegistrationsData }) {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [missingOnly, setMissingOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [command, setCommand] = useState<Command | null>(null);
  const task = useAdminTask();
  const rows = data.registrations;
  const occupied = rows.filter((row) => holdsSeat(row.status)).length;
  const waiting = rows.filter((row) => row.status === 'waitlist').length;
  const missing = rows.filter(needsConfirmation).length;

  const visible = rows
    .filter((row) => status === 'all' || row.status === status)
    .filter((row) => !missingOnly || needsConfirmation(row))
    .filter((row) =>
      `${row.firstName} ${row.lastName} ${row.email} ${row.phone}`
        .toLocaleLowerCase('de')
        .includes(search.toLocaleLowerCase('de')),
    );

  const eligible = visible.filter((row) => row.status === 'registered' || row.status === 'waitlist');

  async function refresh() {
    const result = await actions.loadAdminRegistrations({ eventId: data.eventId });

    if (result.error) throw new Error(result.error.message);

    setData(result.data);
    setSelected(
      (current) =>
        new Set(
          [...current].filter((id) =>
            result.data.registrations.some(
              (row) => row.id === id && (row.status === 'registered' || row.status === 'waitlist'),
            ),
          ),
        ),
    );
  }

  function prepare(next: Command) {
    task.setNotice(null);
    setCommand(next);
  }

  function confirmations(ids?: string[], onlyMissing = false) {
    prepare({
      title: 'Bestätigungen versenden?',
      actionLabel: 'Bestätigungen senden',
      description: ids
        ? `Anmeldebestätigung an ${ids.length} ausgewählte Person(en) senden?`
        : onlyMissing
          ? `Nur die ${missing} fehlenden Anmeldebestätigungen senden?`
          : 'Bestätigungen an alle angemeldeten und wartenden Personen erneut senden?',
      request: () => actions.resendConfirmations({ eventId: data.eventId, ids, onlyMissing }),
    });
  }

  function changeStatus(row: RegistrationRow, next: RegistrationStatus) {
    const request = () => actions.setRegistrationStatus({ id: row.id, status: next });

    if (next === 'cancelled' || next === 'registered') {
      prepare({
        title: `Status auf „${statusLabel[next]}“ setzen?`,
        actionLabel: 'Status ändern',
        description: `${row.firstName} ${row.lastName}: ${next === 'cancelled' ? 'Bei einer Stornierung eines belegten Platzes kann jemand aus der Warteliste automatisch nachrücken.' : 'Diese manuelle Änderung belegt einen Platz. Bitte prüfe die verfügbare Kapazität.'}`,
        request,
      });

      return;
    }

    void task.run(row.id, request, refresh);
  }

  return (
    <>
      <AdminHead title={data.eventTitle} description="Anmeldungen, Warteliste und Nachrichten für diesen Termin.">
        <a class={button({ variant: 'secondary', size: 'sm' })} href="/admin">
          Zur Übersicht
        </a>
        <a class={button({ variant: 'secondary', size: 'sm' })} href={`/admin/events/${data.eventId}`}>
          Termin bearbeiten
        </a>
        <button
          type="button"
          class={button({ variant: 'secondary', size: 'sm' })}
          disabled={!!task.busy}
          onClick={() =>
            void task.run('refresh', () => actions.loadAdminRegistrations({ eventId: data.eventId }), setData)
          }
        >
          Aktualisieren
        </button>
      </AdminHead>
      <dl class="mb-6 grid grid-cols-2 gap-5 border-y border-line py-5 sm:grid-cols-4">
        <div>
          <dt class="text-sm text-fg-muted">Plätze belegt</dt>
          <dd class="mt-1 text-2xl font-semibold tabular-nums">
            {occupied} / {data.maxParticipants}
          </dd>
        </div>
        <div>
          <dt class="text-sm text-fg-muted">Plätze frei</dt>
          <dd class="mt-1 text-2xl font-semibold tabular-nums">{Math.max(0, data.maxParticipants - occupied)}</dd>
        </div>
        <div>
          <dt class="text-sm text-fg-muted">Warteliste</dt>
          <dd class="mt-1 text-2xl font-semibold tabular-nums">{waiting}</dd>
        </div>
        <div>
          <dt class="text-sm text-fg-muted">Bestätigung fehlt</dt>
          <dd class={`mt-1 text-2xl font-semibold tabular-nums ${missing ? 'text-accent' : ''}`}>{missing}</dd>
        </div>
      </dl>
      <Feedback notice={task.notice} />
      <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          class={button({ size: 'sm', variant: 'secondary' })}
          disabled={!missing || !!task.busy}
          onClick={() => confirmations(undefined, true)}
        >
          Fehlende Bestätigungen senden ({missing})
        </button>
        <details class="relative">
          <summary class="cursor-pointer px-2 py-3 text-sm text-fg-muted">Weitere Versandaktionen</summary>
          <div class="absolute right-0 z-10 mt-2 min-w-56 border border-line-strong bg-raised p-2 shadow-overlay">
            <button
              type="button"
              disabled={!rows.length || !!task.busy}
              class="w-full px-3 py-2 text-left text-sm"
              onClick={() => confirmations()}
            >
              Alle Bestätigungen erneut senden
            </button>
          </div>
        </details>
      </div>
      <section aria-label="Anmeldungen filtern">
        <div class="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
          <label class="grid gap-2 text-sm font-semibold">
            Suchen
            <input
              type="search"
              placeholder="Name, E-Mail oder Telefon"
              value={search}
              onInput={(event) => setSearch(event.currentTarget.value)}
              class={control('sm')}
            />
          </label>
          <label class="grid gap-2 text-sm font-semibold">
            Status
            <select class={control('sm')} value={status} onChange={(event) => setStatus(event.currentTarget.value)}>
              <option value="all">Alle</option>
              {Object.entries(statusLabel).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <label class="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={missingOnly}
              onChange={(event) => setMissingOnly(event.currentTarget.checked)}
              class="size-4 accent-accent"
            />
            Nur fehlende Bestätigungen
          </label>
          <p role="status" class="text-fg-muted">
            {visible.length} von {rows.length} Anmeldungen
          </p>
        </div>
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <label class="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              aria-label="Alle sichtbaren aktiven Anmeldungen auswählen"
              disabled={!eligible.length}
              checked={eligible.length > 0 && eligible.every((row) => selected.has(row.id))}
              onChange={(event) => {
                const checked = event.currentTarget.checked;

                setSelected((current) => {
                  const next = new Set(current);

                  eligible.forEach((row) => (checked ? next.add(row.id) : next.delete(row.id)));

                  return next;
                });
              }}
              class="size-4 accent-accent"
            />
            Sichtbare auswählen
          </label>
          {selected.size > 0 && (
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-sm text-fg-muted">{selected.size} ausgewählt</span>
              <button
                class={button({ variant: 'secondary', size: 'xs' })}
                type="button"
                disabled={!!task.busy}
                onClick={() => confirmations([...selected])}
              >
                Bestätigungen für Auswahl senden
              </button>
              <button type="button" onClick={() => setSelected(new Set())} class="text-sm text-fg-muted underline">
                Auswahl aufheben
              </button>
            </div>
          )}
        </div>
        {!visible.length && (
          <p class="border border-dashed border-line-strong p-8 text-fg-muted">
            {rows.length ? 'Keine Anmeldungen für diese Auswahl.' : 'Noch keine Anmeldungen zu diesem Termin.'}
          </p>
        )}
        <ul class="grid gap-3" aria-label="Anmeldungen">
          {visible.map((row) => (
            <RegistrationCard
              key={row.id}
              row={row}
              busy={!!task.busy}
              selected={selected.has(row.id)}
              onSelect={(checked) =>
                setSelected((current) => {
                  const next = new Set(current);

                  if (checked) next.add(row.id);
                  else next.delete(row.id);

                  return next;
                })
              }
              onStatus={(next) => changeStatus(row, next)}
              onSend={() => confirmations([row.id])}
              onRemove={() =>
                prepare({
                  title: 'Anmeldung entfernen?',
                  description: `Die Anmeldung von ${row.firstName} ${row.lastName} wird entfernt.`,
                  actionLabel: 'Anmeldung entfernen',
                  danger: true,
                  request: () => actions.deleteRegistration({ id: row.id }),
                })
              }
            />
          ))}
        </ul>
      </section>
      <Broadcast eventId={data.eventId} count={rows.filter((row) => row.status === 'registered').length} />
      {command && (
        <ConfirmDialog
          title={command.title}
          actionLabel={command.actionLabel}
          danger={command.danger}
          busy={!!task.busy}
          error={task.notice?.tone === 'error' ? task.notice.text : undefined}
          onCancel={() => setCommand(null)}
          onConfirm={async () => {
            const result = await task.run('command', command.request, refresh);

            if (result) setCommand(null);
          }}
        >
          <p>{command.description}</p>
        </ConfirmDialog>
      )}
    </>
  );
}

function RegistrationCard({
  row,
  busy,
  selected,
  onSelect,
  onStatus,
  onSend,
  onRemove,
}: {
  row: RegistrationRow;
  busy: boolean;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onStatus: (status: RegistrationStatus) => void;
  onSend: () => void;
  onRemove: () => void;
}) {
  const eligible = row.status === 'registered' || row.status === 'waitlist';
  const name = `${row.firstName} ${row.lastName}`;

  return (
    <li class={`${card} grid gap-4 p-5`}>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex min-w-0 items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            disabled={!eligible || busy}
            onChange={(event) => onSelect(event.currentTarget.checked)}
            aria-label={`${name} auswählen`}
            class="mt-1 size-4 shrink-0 accent-accent"
          />
          <div class="min-w-0">
            <h2 class="font-semibold text-fg">{name}</h2>
            <a class="mt-1 block break-all text-sm text-fg-muted hover:text-accent" href={`mailto:${row.email}`}>
              {row.email}
            </a>
            {row.phone && (
              <a class="mt-1 block text-sm text-fg-muted hover:text-accent" href={`tel:${row.phone}`}>
                {row.phone}
              </a>
            )}
          </div>
        </div>
        <Badge active={holdsSeat(row.status)}>{statusLabel[row.status]}</Badge>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <p class="text-xs leading-relaxed text-fg-muted">
          Angemeldet: {shortDate(row.registeredAt)}
          <br />
          {row.confirmationSentAt
            ? `Bestätigung gesendet: ${shortDate(row.confirmationSentAt)}`
            : eligible
              ? 'Bestätigung noch nicht nachgewiesen'
              : 'Keine Bestätigung erforderlich'}
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <select
            value={row.status}
            disabled={busy}
            onChange={(event) => onStatus(event.currentTarget.value as RegistrationStatus)}
            aria-label={`Status von ${name}`}
            class={control('xs')}
          >
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {eligible && (
            <button type="button" disabled={busy} onClick={onSend} class={button({ variant: 'secondary', size: 'xs' })}>
              Bestätigung senden
            </button>
          )}
          <button type="button" disabled={busy} onClick={onRemove} class={button({ variant: 'danger', size: 'xs' })}>
            Entfernen
          </button>
        </div>
      </div>
    </li>
  );
}

function Broadcast({ eventId, count }: { eventId: string; count: number }) {
  const task = useAdminTask();
  const [draft, setDraft] = useState<{ subject: string; content: string } | null>(null);

  return (
    <details class="mt-10 border-t border-line pt-6">
      <summary class="cursor-pointer text-xl font-semibold">Nachricht an Teilnehmer senden</summary>
      <p class="mt-3 max-w-measure text-sm text-fg-muted">
        Geht an die {count} Personen mit Status „Angemeldet“. Warteliste, stornierte Anmeldungen und bereits als
        teilgenommen markierte Personen sind ausgenommen. {'{first_name}'} wird durch den Vornamen ersetzt.
      </p>
      <Feedback notice={task.notice} />
      <form
        class="mt-5 grid gap-4"
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          const body = new FormData(event.currentTarget);

          task.setNotice(null);
          setDraft({ subject: String(body.get('subject') ?? ''), content: String(body.get('content') ?? '') });
        }}
      >
        <fieldset disabled={!!task.busy || !count} class="grid gap-4 border-0 p-0">
          <label class="grid gap-2 text-sm font-semibold">
            Betreff
            <input name="subject" required class={control('sm')} />
          </label>
          <label class="grid gap-2 text-sm font-semibold">
            Nachricht
            <textarea name="content" required rows={7} class={`${control('sm')} resize-y`} />
          </label>
          <button type="submit" class={`${button({ variant: 'secondary', size: 'sm' })} justify-self-start`}>
            Nachricht prüfen
          </button>
        </fieldset>
      </form>
      {draft && (
        <ConfirmDialog
          title="Nachricht versenden?"
          actionLabel={`An ${count} Teilnehmer senden`}
          busy={!!task.busy}
          error={task.notice?.tone === 'error' ? task.notice.text : undefined}
          onCancel={() => setDraft(null)}
          onConfirm={async () => {
            const result = await task.run('broadcast', () => actions.sendEventMessage({ id: eventId, ...draft }));

            if (result) setDraft(null);
          }}
        >
          <p>Empfänger: {count} angemeldete Personen dieses Termins.</p>
          <p class="text-fg">
            <strong>Betreff:</strong> {draft.subject}
          </p>
          <p class="max-h-48 overflow-auto whitespace-pre-wrap">{draft.content}</p>
        </ConfirmDialog>
      )}
    </details>
  );
}
