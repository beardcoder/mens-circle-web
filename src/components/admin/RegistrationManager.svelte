<script lang="ts">
  import { adminApi } from '@lib/admin-client';

  type Status = 'registered' | 'waitlist' | 'cancelled' | 'attended';

  interface Reg {
    id: string;
    status: Status;
    registeredAt: string | null;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }

  interface Props {
    eventId: string;
    eventTitle: string;
    maxParticipants: number;
    registrations: Reg[];
  }

  let { eventId, eventTitle, maxParticipants, registrations }: Props = $props();
  let regs = $state<Reg[]>(registrations);
  let toast = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const STATUS_LABEL: Record<Status, string> = {
    registered: 'Angemeldet',
    waitlist: 'Warteliste',
    cancelled: 'Storniert',
    attended: 'Teilgenommen',
  };

  const activeCount = $derived(regs.filter((r) => r.status === 'registered' || r.status === 'attended').length);
  const waitlistCount = $derived(regs.filter((r) => r.status === 'waitlist').length);

  function fmt(iso: string | null): string {
    if (!iso) return '–';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '–' : d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
  }

  async function changeStatus(reg: Reg, status: Status): Promise<void> {
    const res = await adminApi.patch(`/api/admin/registrations/${reg.id}`, { status });
    toast = { kind: res.success ? 'ok' : 'err', text: res.message };
    if (res.success) {
      regs = regs.map((r) => (r.id === reg.id ? { ...r, status } : r));
      // A cancellation may have promoted someone — reload to reflect it.
      if (status === 'cancelled') setTimeout(() => window.location.reload(), 600);
    }
  }

  async function remove(reg: Reg): Promise<void> {
    if (!confirm(`Anmeldung von ${reg.firstName} ${reg.lastName} entfernen?`)) return;
    const res = await adminApi.del(`/api/admin/registrations/${reg.id}`);
    toast = { kind: res.success ? 'ok' : 'err', text: res.message };
    if (res.success) regs = regs.filter((r) => r.id !== reg.id);
  }

  // ── Broadcast ──
  let subject = $state('');
  let content = $state('');
  let sending = $state(false);

  async function sendMessage(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (!subject.trim() || !content.trim()) {
      toast = { kind: 'err', text: 'Betreff und Nachricht sind erforderlich.' };
      return;
    }
    sending = true;
    const res = await adminApi.post(`/api/admin/events/${eventId}/message`, { subject, content });
    sending = false;
    toast = { kind: res.success ? 'ok' : 'err', text: res.message };
    if (res.success) {
      subject = '';
      content = '';
    }
  }
</script>

<div class="head">
  <div>
    <h1>Anmeldungen</h1>
    <p class="admin-muted">{eventTitle}</p>
  </div>
  <a class="admin-btn admin-btn--ghost" href="/admin">Zurück</a>
</div>

{#if toast}
  <div class="admin-toast admin-toast--{toast.kind === 'ok' ? 'ok' : 'err'}">{toast.text}</div>
{/if}

<p class="admin-muted summary">
  <strong>{activeCount}</strong> / {maxParticipants} belegt · <strong>{waitlistCount}</strong> auf der Warteliste
</p>

{#if regs.length === 0}
  <p class="admin-muted">Noch keine Anmeldungen.</p>
{:else}
  <div class="admin-card">
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Kontakt</th>
          <th>Angemeldet</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each regs as reg (reg.id)}
          <tr>
            <td>{reg.firstName} {reg.lastName}</td>
            <td>
              <a href={`mailto:${reg.email}`}>{reg.email}</a>
              {#if reg.phone}<div class="admin-muted">{reg.phone}</div>{/if}
            </td>
            <td>{fmt(reg.registeredAt)}</td>
            <td>
              <span
                class="admin-badge"
                class:admin-badge--ok={reg.status === 'registered' || reg.status === 'attended'}
                class:admin-badge--wait={reg.status === 'waitlist'}
                class:admin-badge--off={reg.status === 'cancelled'}
              >
                {STATUS_LABEL[reg.status]}
              </span>
            </td>
            <td class="actions">
              <select
                value={reg.status}
                onchange={(e) => changeStatus(reg, (e.currentTarget as HTMLSelectElement).value as Status)}
              >
                <option value="registered">Angemeldet</option>
                <option value="waitlist">Warteliste</option>
                <option value="attended">Teilgenommen</option>
                <option value="cancelled">Storniert</option>
              </select>
              <button class="admin-btn admin-btn--danger admin-btn--small" onclick={() => remove(reg)}>Entfernen</button
              >
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<h2>Nachricht an Teilnehmer:innen</h2>
<form class="admin-card" onsubmit={sendMessage}>
  <p class="admin-muted">
    Geht per E-Mail an alle <strong>angemeldeten</strong> Teilnehmer:innen. Platzhalter
    <code>{'{first_name}'}</code> wird durch den Vornamen ersetzt.
  </p>
  <div class="field">
    <label for="msg-subject">Betreff</label>
    <input id="msg-subject" type="text" bind:value={subject} disabled={sending} />
  </div>
  <div class="field">
    <label for="msg-content">Nachricht</label>
    <textarea id="msg-content" rows="6" bind:value={content} disabled={sending}></textarea>
  </div>
  <button class="admin-btn" type="submit" disabled={sending}>{sending ? 'Senden…' : 'Nachricht senden'}</button>
</form>

<style>
  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }
  .head p {
    margin: 0;
  }
  .summary {
    margin-top: -0.5rem;
  }
  .field {
    margin-bottom: 1rem;
  }
  .actions {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .actions select {
    width: auto;
    font-size: 0.8rem;
    padding: 0.3rem;
  }
  code {
    background: var(--a-bg);
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
  }
</style>
