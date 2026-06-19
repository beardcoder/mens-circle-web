<script lang="ts">
  import { adminApi } from '@lib/admin-client';

  interface EventRow {
    id: string;
    title: string;
    slug: string;
    eventDate: string;
    isPublished: boolean;
    maxParticipants: number;
    activeCount: number;
  }

  interface Props {
    events: EventRow[];
  }

  let { events }: Props = $props();
  let toast = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function fmtDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
  }

  async function remove(ev: EventRow): Promise<void> {
    if (!confirm(`„${ev.title}" wirklich löschen?`)) return;
    const res = await adminApi.del(`/api/admin/events/${ev.id}`);
    toast = { kind: res.success ? 'ok' : 'err', text: res.message };
    if (res.success) events = events.filter((e) => e.id !== ev.id);
  }
</script>

<div class="head">
  <h1>Veranstaltungen</h1>
  <a class="admin-btn" href="/admin/events/new">+ Neue Veranstaltung</a>
</div>

{#if toast}
  <div class="admin-toast admin-toast--{toast.kind === 'ok' ? 'ok' : 'err'}">{toast.text}</div>
{/if}

{#if events.length === 0}
  <p class="admin-muted">Noch keine Veranstaltungen. Lege die erste an.</p>
{:else}
  <div class="admin-card">
    <table>
      <thead>
        <tr>
          <th>Titel</th>
          <th>Datum</th>
          <th>Status</th>
          <th>Anmeldungen</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each events as ev (ev.id)}
          <tr>
            <td>
              <a href={`/admin/events/${ev.id}`}>{ev.title}</a>
              <div class="admin-muted slug">/event/{ev.slug}</div>
            </td>
            <td>{fmtDate(ev.eventDate)}</td>
            <td>
              {#if ev.isPublished}
                <span class="admin-badge admin-badge--ok">Veröffentlicht</span>
              {:else}
                <span class="admin-badge admin-badge--off">Entwurf</span>
              {/if}
            </td>
            <td>{ev.activeCount} / {ev.maxParticipants}</td>
            <td class="actions">
              <a class="admin-btn admin-btn--ghost admin-btn--small" href={`/admin/events/${ev.id}/registrations`}>
                Anmeldungen
              </a>
              <a class="admin-btn admin-btn--ghost admin-btn--small" href={`/admin/events/${ev.id}`}>Bearbeiten</a>
              <button class="admin-btn admin-btn--danger admin-btn--small" onclick={() => remove(ev)}>Löschen</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .slug {
    font-size: 0.75rem;
  }
  .actions {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
</style>
