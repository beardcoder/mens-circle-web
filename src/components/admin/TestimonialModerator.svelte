<script lang="ts">
  import { adminApi } from '@lib/admin-client';

  interface Testimonial {
    id: string;
    quote: string;
    authorName: string;
    role: string;
    email: string;
    isPublished: boolean;
    sortOrder: number;
    createdAt: string;
  }

  interface Props {
    testimonials: Testimonial[];
  }

  let { testimonials }: Props = $props();
  let items = $state<Testimonial[]>(testimonials);
  let toast = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function togglePublish(t: Testimonial): Promise<void> {
    const publish = !t.isPublished;
    const res = await adminApi.patch(`/api/admin/testimonials/${t.id}`, { publish });
    toast = { kind: res.success ? 'ok' : 'err', text: res.message };
    if (res.success) items = items.map((i) => (i.id === t.id ? { ...i, isPublished: publish } : i));
  }

  async function saveOrder(t: Testimonial, value: string): Promise<void> {
    const sortOrder = Number(value) || 0;
    const res = await adminApi.patch(`/api/admin/testimonials/${t.id}`, { sortOrder });
    toast = { kind: res.success ? 'ok' : 'err', text: res.message };
    if (res.success) items = items.map((i) => (i.id === t.id ? { ...i, sortOrder } : i));
  }

  async function remove(t: Testimonial): Promise<void> {
    if (!confirm('Diese Stimme wirklich löschen?')) return;
    const res = await adminApi.del(`/api/admin/testimonials/${t.id}`);
    toast = { kind: res.success ? 'ok' : 'err', text: res.message };
    if (res.success) items = items.filter((i) => i.id !== t.id);
  }
</script>

<h1>Stimmen / Testimonials</h1>

{#if toast}
  <div class="admin-toast admin-toast--{toast.kind === 'ok' ? 'ok' : 'err'}">{toast.text}</div>
{/if}

{#if items.length === 0}
  <p class="admin-muted">Noch keine Einreichungen.</p>
{:else}
  <div class="list">
    {#each items as t (t.id)}
      <article class="admin-card item">
        <blockquote>{t.quote}</blockquote>
        <div class="meta admin-muted">
          {#if t.authorName}<strong>{t.authorName}</strong>{/if}
          {#if t.role}· {t.role}{/if}
          {#if t.email}· {t.email}{/if}
        </div>
        <div class="controls">
          {#if t.isPublished}
            <span class="admin-badge admin-badge--ok">Veröffentlicht</span>
          {:else}
            <span class="admin-badge admin-badge--off">Unsichtbar</span>
          {/if}
          <label class="order">
            Reihenfolge
            <input
              type="number"
              value={t.sortOrder}
              onchange={(e) => saveOrder(t, (e.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <button class="admin-btn admin-btn--small" onclick={() => togglePublish(t)}>
            {t.isPublished ? 'Verbergen' : 'Veröffentlichen'}
          </button>
          <button class="admin-btn admin-btn--danger admin-btn--small" onclick={() => remove(t)}>Löschen</button>
        </div>
      </article>
    {/each}
  </div>
{/if}

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  blockquote {
    margin: 0 0 0.5rem;
    font-style: italic;
  }
  .meta {
    font-size: 0.85rem;
    margin-bottom: 0.75rem;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .order {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    font-weight: 400;
    margin: 0;
    color: var(--a-muted);
  }
  .order input {
    width: 4rem;
    padding: 0.25rem 0.4rem;
  }
</style>
