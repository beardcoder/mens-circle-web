import { actions } from 'astro:actions';
import { useState } from 'preact/hooks';

import { button, card, control } from '@lib/ui';

import { Icon } from './icons';
import type { RegistrationRow, RegistrationsData, RegistrationStatus } from './types';
import {
  ConfirmDialog,
  Feedback,
  holdsSeat,
  iconButton,
  Meter,
  needsConfirmation,
  PageHeader,
  SearchField,
  shortDate,
  Stat,
  statusLabel,
  Tabs,
} from './ui';
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
  const [status, setStatus] = useState<RegistrationStatus | 'all'>('all');
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
      <PageHeader
        title={data.eventTitle}
        description="Anmeldungen, Warteliste und Nachrichten für diesen Termin."
        back={{ href: '/admin/events', label: 'Termine' }}
      >
        <button
          type="button"
          class={button({ variant: 'secondary', size: 'sm' })}
          disabled={!!task.busy}
          onClick={() =>
            void task.run('refresh', () => actions.loadAdminRegistrations({ eventId: data.eventId }), setData)
          }
        >
          <Icon name="refresh" class="size-4.5" />
          Aktualisieren
        </button>
        <a class={button({ variant: 'secondary', size: 'sm' })} href={`/admin/events/${data.eventId}`}>
          <Icon name="edit" class="size-4.5" />
          Termin bearbeiten
        </a>
      </PageHeader>
      <div class="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat
          label="Plätze belegt"
          icon="users"
          value={`${occupied}/${data.maxParticipants}`}
          hint={<Meter value={occupied} max={data.maxParticipants} label="Plätze belegt" />}
        />
        <Stat label="Plätze frei" icon="calendar" value={Math.max(0, data.maxParticipants - occupied)} />
        <Stat label="Warteliste" icon="clock" value={waiting} />
        <Stat
          label="Bestätigung fehlt"
          icon="mail"
          value={missing}
          tone={missing ? 'accent' : undefined}
          hint={missing ? 'noch nicht versendet' : 'alle versendet'}
        />
      </div>
      <Feedback notice={task.notice} />
      <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section aria-label="Anmeldungen" class="min-w-0">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Tabs
              label="Nach Status filtern"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'Alle', count: rows.length },
                ...(Object.entries(statusLabel) as [RegistrationStatus, string][]).map(([value, label]) => ({
                  value,
                  label,
                  count: rows.filter((row) => row.status === value).length,
                })),
              ]}
            />
            <SearchField
              label="Anmeldungen durchsuchen"
              placeholder="Name, E-Mail oder Telefon"
              value={search}
              onInput={setSearch}
            />
          </div>
          <div class={card}>
            <div class="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-5">
              {selected.size > 0 ? (
                <div class="flex flex-wrap items-center gap-3">
                  <span class="text-sm font-semibold">{selected.size} ausgewählt</span>
                  <button
                    class={button({ size: 'xs' })}
                    type="button"
                    disabled={!!task.busy}
                    onClick={() => confirmations([...selected])}
                  >
                    <Icon name="send" class="size-4" />
                    Bestätigungen senden
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    class="text-sm text-fg-muted underline hover:text-fg"
                  >
                    Auswahl aufheben
                  </button>
                </div>
              ) : (
                <label class="flex cursor-pointer items-center gap-3 text-sm text-fg-muted">
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
                  <span role="status">
                    {visible.length} von {rows.length} Anmeldungen
                  </span>
                </label>
              )}
              <label class="flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
                <input
                  type="checkbox"
                  checked={missingOnly}
                  onChange={(event) => setMissingOnly(event.currentTarget.checked)}
                  class="size-4 accent-accent"
                />
                Nur fehlende Bestätigungen
              </label>
            </div>
            {visible.length ? (
              <ul class="divide-y divide-line" aria-label="Anmeldungen">
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
            ) : (
              <p class="px-5 py-12 text-center text-fg-muted">
                {rows.length ? 'Keine Anmeldungen für diese Auswahl.' : 'Noch keine Anmeldungen zu diesem Termin.'}
              </p>
            )}
          </div>
        </section>
        <aside class="grid gap-6 xl:sticky xl:top-6" aria-label="Versand">
          <ConfirmationPanel
            missing={missing}
            disabled={!!task.busy}
            empty={!rows.length}
            onMissing={() => confirmations(undefined, true)}
            onAll={() => confirmations()}
          />
          <Broadcast eventId={data.eventId} count={rows.filter((row) => row.status === 'registered').length} />
        </aside>
      </div>
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
    <li class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 px-4 py-4 sm:px-5 lg:grid-cols-[auto_minmax(0,1fr)_10rem_10rem_4.75rem] lg:items-center lg:gap-x-4">
      <input
        type="checkbox"
        checked={selected}
        disabled={!eligible || busy}
        onChange={(event) => onSelect(event.currentTarget.checked)}
        aria-label={`${name} auswählen`}
        class="col-start-1 row-start-1 mt-1 size-4 shrink-0 accent-accent lg:mt-0"
      />
      <div class="col-start-2 row-start-1 min-w-0">
        <h3 class="font-sans font-semibold">{name}</h3>
        <p class="mt-0.5 flex min-w-0 flex-wrap gap-x-3 text-sm text-fg-muted">
          <a class="min-w-0 truncate hover:text-accent" href={`mailto:${row.email}`}>
            {row.email}
          </a>
          {row.phone && (
            <a class="hover:text-accent" href={`tel:${row.phone}`}>
              {row.phone}
            </a>
          )}
        </p>
      </div>
      <select
        value={row.status}
        disabled={busy}
        onChange={(event) => onStatus(event.currentTarget.value as RegistrationStatus)}
        aria-label={`Status von ${name}`}
        class={`${control('xs')} col-start-2 row-start-2 justify-self-start lg:col-start-3 lg:row-start-1 lg:w-full`}
      >
        {Object.entries(statusLabel).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <p class="col-span-2 col-start-2 row-start-3 text-xs leading-relaxed text-fg-muted lg:col-span-1 lg:col-start-4 lg:row-start-1">
        Angemeldet {shortDate(row.registeredAt)}
        <br />
        {row.confirmationSentAt ? (
          `Bestätigt ${shortDate(row.confirmationSentAt)}`
        ) : eligible ? (
          <span class="text-accent">Bestätigung fehlt</span>
        ) : (
          'Keine Bestätigung nötig'
        )}
      </p>
      <div class="col-start-3 row-start-1 flex items-center justify-end gap-1 lg:col-start-5">
        {eligible && (
          <button
            type="button"
            disabled={busy}
            onClick={onSend}
            class={iconButton}
            aria-label={`Bestätigung an ${name} senden`}
            title="Bestätigung senden"
          >
            <Icon name="send" class="size-4.5" />
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          class={`${iconButton} hover:text-danger`}
          aria-label={`Anmeldung von ${name} entfernen`}
          title="Entfernen"
        >
          <Icon name="trash" class="size-4.5" />
        </button>
      </div>
    </li>
  );
}

function ConfirmationPanel({
  missing,
  disabled,
  empty,
  onMissing,
  onAll,
}: {
  missing: number;
  disabled: boolean;
  empty: boolean;
  onMissing: () => void;
  onAll: () => void;
}) {
  return (
    <section aria-labelledby="confirm-title-aside" class={`${card} grid gap-4 p-5`}>
      <div>
        <h2 id="confirm-title-aside" class="font-sans text-base font-semibold">
          Bestätigungen
        </h2>
        <p class="mt-1 text-sm text-fg-muted">
          {missing
            ? `${missing} Person${missing > 1 ? 'en haben' : ' hat'} noch keine Bestätigung.`
            : 'Alle Bestätigungen sind versendet.'}
        </p>
      </div>
      <button
        type="button"
        class={button({ size: 'sm', block: true })}
        disabled={!missing || disabled}
        onClick={onMissing}
      >
        <Icon name="send" class="size-4.5" />
        Fehlende senden ({missing})
      </button>
      <button
        type="button"
        disabled={empty || disabled}
        class="text-sm text-fg-muted underline hover:text-fg disabled:opacity-50"
        onClick={onAll}
      >
        Alle Bestätigungen erneut senden
      </button>
    </section>
  );
}

function Broadcast({ eventId, count }: { eventId: string; count: number }) {
  const task = useAdminTask();
  const [draft, setDraft] = useState<{ subject: string; content: string } | null>(null);

  return (
    <section aria-labelledby="broadcast-title" class={`${card} p-5`}>
      <h2 id="broadcast-title" class="font-sans text-base font-semibold">
        Nachricht an Teilnehmer
      </h2>
      <p class="mt-1 text-sm text-fg-muted">
        Geht an die {count} Personen mit Status „Angemeldet“. Warteliste, stornierte Anmeldungen und bereits als
        teilgenommen markierte Personen sind ausgenommen. {'{first_name}'} wird durch den Vornamen ersetzt.
      </p>
      <div class="mt-4">
        <Feedback notice={task.notice} />
      </div>
      <form
        class="mt-4 grid gap-4"
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
            <textarea name="content" required rows={6} class={`${control('sm')} resize-y`} />
          </label>
          <button type="submit" class={button({ variant: 'secondary', size: 'sm', block: true })}>
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
    </section>
  );
}
