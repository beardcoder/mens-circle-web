<script lang="ts">
  import { adminApi } from '@lib/admin-client';

  interface EventData {
    id?: string;
    title?: string;
    slug?: string;
    description?: string;
    eventDate?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    locationDetails?: string;
    street?: string;
    postalCode?: string;
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
    maxParticipants?: number;
    costBasis?: string;
    isPublished?: boolean;
    imageUrl?: string | null;
  }

  interface Props {
    event?: EventData | null;
  }
  const { event = null }: Props = $props();

  const isEdit = !!event?.id;

  // Date input wants YYYY-MM-DD.
  const initialDate = event?.eventDate ? String(event.eventDate).slice(0, 10) : '';

  let title = $state(event?.title ?? '');
  let slug = $state(event?.slug ?? '');
  let eventDate = $state(initialDate);
  let startTime = $state(event?.startTime ?? '');
  let endTime = $state(event?.endTime ?? '');
  let maxParticipants = $state(event?.maxParticipants ?? 8);
  let costBasis = $state(event?.costBasis ?? '');
  let location = $state(event?.location ?? '');
  let street = $state(event?.street ?? '');
  let postalCode = $state(event?.postalCode ?? '');
  let city = $state(event?.city ?? '');
  let locationDetails = $state(event?.locationDetails ?? '');
  let latitude = $state(event?.latitude ?? ('' as number | string));
  let longitude = $state(event?.longitude ?? ('' as number | string));
  let description = $state(event?.description ?? '');
  let imageUrl = $state(event?.imageUrl ?? '');
  let isPublished = $state(event?.isPublished ?? false);

  let submitting = $state(false);
  let toast = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function handleSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    toast = null;
    if (!title.trim() || !eventDate) {
      toast = { kind: 'err', text: 'Titel und Datum sind erforderlich.' };
      return;
    }
    submitting = true;
    const payload = {
      title,
      slug,
      eventDate,
      startTime,
      endTime,
      maxParticipants,
      costBasis,
      location,
      street,
      postalCode,
      city,
      locationDetails,
      latitude: latitude === '' ? null : Number(latitude),
      longitude: longitude === '' ? null : Number(longitude),
      description,
      imageUrl,
      isPublished,
    };
    const res = isEdit
      ? await adminApi.put(`/api/admin/events/${event!.id}`, payload)
      : await adminApi.post('/api/admin/events', payload);
    submitting = false;
    toast = { kind: res.success ? 'ok' : 'err', text: res.message };
    if (res.success && !isEdit) {
      window.location.href = '/admin';
    }
  }
</script>

<div class="head">
  <h1>{isEdit ? 'Veranstaltung bearbeiten' : 'Neue Veranstaltung'}</h1>
  <a class="admin-btn admin-btn--ghost" href="/admin">Zurück</a>
</div>

{#if toast}
  <div class="admin-toast admin-toast--{toast.kind === 'ok' ? 'ok' : 'err'}">{toast.text}</div>
{/if}

<form class="admin-card" onsubmit={handleSubmit}>
  <div class="field">
    <label for="title">Titel *</label>
    <input id="title" type="text" bind:value={title} required disabled={submitting} />
  </div>

  <div class="admin-row">
    <div class="field">
      <label for="eventDate">Datum *</label>
      <input id="eventDate" type="date" bind:value={eventDate} required disabled={submitting} />
    </div>
    <div class="field">
      <label for="startTime">Beginn</label>
      <input id="startTime" type="time" bind:value={startTime} disabled={submitting} />
    </div>
    <div class="field">
      <label for="endTime">Ende</label>
      <input id="endTime" type="time" bind:value={endTime} disabled={submitting} />
    </div>
  </div>

  <div class="admin-row">
    <div class="field">
      <label for="maxParticipants">Max. Teilnehmer</label>
      <input id="maxParticipants" type="number" min="0" bind:value={maxParticipants} disabled={submitting} />
    </div>
    <div class="field">
      <label for="costBasis">Teilnahmebeitrag</label>
      <input
        id="costBasis"
        type="text"
        bind:value={costBasis}
        placeholder="z. B. Auf Spendenbasis"
        disabled={submitting}
      />
    </div>
    <div class="field">
      <label for="slug">Slug (optional)</label>
      <input id="slug" type="text" bind:value={slug} placeholder="auto aus Datum" disabled={submitting} />
    </div>
  </div>

  <div class="field">
    <label for="location">Ort (Name)</label>
    <input id="location" type="text" bind:value={location} disabled={submitting} />
  </div>

  <div class="admin-row">
    <div class="field">
      <label for="street">Straße</label>
      <input id="street" type="text" bind:value={street} disabled={submitting} />
    </div>
    <div class="field">
      <label for="postalCode">PLZ</label>
      <input id="postalCode" type="text" bind:value={postalCode} disabled={submitting} />
    </div>
    <div class="field">
      <label for="city">Stadt</label>
      <input id="city" type="text" bind:value={city} disabled={submitting} />
    </div>
  </div>

  <div class="admin-row">
    <div class="field">
      <label for="latitude">Breitengrad (lat)</label>
      <input id="latitude" type="number" step="any" bind:value={latitude} disabled={submitting} />
    </div>
    <div class="field">
      <label for="longitude">Längengrad (lng)</label>
      <input id="longitude" type="number" step="any" bind:value={longitude} disabled={submitting} />
    </div>
  </div>

  <div class="field">
    <label for="locationDetails">Hinweis zum Ort / Treffpunkt</label>
    <textarea id="locationDetails" bind:value={locationDetails} disabled={submitting}></textarea>
  </div>

  <div class="field">
    <label for="description">Beschreibung</label>
    <textarea id="description" rows="6" bind:value={description} disabled={submitting}></textarea>
  </div>

  <div class="field">
    <label for="imageUrl">Bild-URL (optional)</label>
    <input id="imageUrl" type="url" bind:value={imageUrl} placeholder="https://…" disabled={submitting} />
  </div>

  <label class="check">
    <input type="checkbox" bind:checked={isPublished} disabled={submitting} />
    <span>Veröffentlicht (öffentlich sichtbar)</span>
  </label>

  <div class="actions">
    <button class="admin-btn" type="submit" disabled={submitting}>
      {submitting ? 'Speichern…' : 'Speichern'}
    </button>
  </div>
</form>

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .field {
    margin-bottom: 1rem;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 400;
    color: var(--a-text);
    margin: 0.5rem 0 1rem;
  }
  .check input {
    width: auto;
  }
  .actions {
    margin-top: 0.5rem;
  }
</style>
