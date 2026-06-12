<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { trackEvent, TRACKING_EVENTS } from '@lib/umami';
  import type { EventData } from '@lib/types';

  interface Props {
    event: EventData;
  }

  const { event }: Props = $props();

  let isOpen = $state(false);
  let icsBlobUrl = $state('');
  const googleUrl = $derived(buildGoogleCalendarUrl(event));

  // ── Calendar helpers (inlined, single consumer) ──────────────

  function formatICSDate(date: string, time: string): string {
    const d = new Date(`${date}T${time}:00`);
    return d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  }

  function buildIcsString(ev: EventData): string {
    const start = formatICSDate(ev.startDate, ev.startTime);
    const end = formatICSDate(ev.endDate, ev.endTime);
    const stamp = formatICSDate(
      new Date().toISOString().slice(0, 10),
      new Date().toISOString().slice(11, 16),
    );

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Männerkreis Niederbayern/ Straubing//DE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `DTSTAMP:${stamp}`,
      `UID:${Date.now()}@maennerkreis-straubing.de`,
      `SUMMARY:${ev.title}`,
      `DESCRIPTION:${ev.description.replace(/\n/g, '\\n')}`,
      `LOCATION:${ev.location}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
  }

  function buildIcsBlobUrl(ev: EventData): string {
    const blob = new Blob([buildIcsString(ev)], {
      type: 'text/calendar;charset=utf-8',
    });
    return URL.createObjectURL(blob);
  }

  function buildGoogleCalendarUrl(ev: EventData): string {
    const formatDate = (date: string, time: string): string =>
      `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: ev.title,
      dates: `${formatDate(ev.startDate, ev.startTime)}/${formatDate(ev.endDate, ev.endTime)}`,
      details: ev.description,
      location: ev.location,
      ctz: 'Europe/Berlin',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  // ── Component logic ──────────────────────────────────────────

  onMount(() => {
    icsBlobUrl = buildIcsBlobUrl(event);
  });

  onDestroy(() => {
    if (icsBlobUrl) URL.revokeObjectURL(icsBlobUrl);
  });

  function open(): void {
    isOpen = true;
    trackEvent(TRACKING_EVENTS.CALENDAR_OPEN, { event: event.title });
  }

  function close(): void {
    isOpen = false;
  }

  function onBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) close();
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && isOpen) close();
  }

  function trackGoogle(): void {
    trackEvent(TRACKING_EVENTS.CALENDAR_DOWNLOAD_GOOGLE, {
      event: event.title,
    });
  }

  function trackIcs(): void {
    trackEvent(TRACKING_EVENTS.CALENDAR_DOWNLOAD_ICS, { event: event.title });
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="event-info__calendar">
  <button type="button" class="btn btn--secondary" onclick={open}>
    <svg class="icon" aria-hidden="true" focusable="false"
      ><use href="#icon-calendar"></use></svg
    >
    In Kalender speichern
  </button>

  <div
    class="calendar-modal"
    class:open={isOpen}
    style:display={isOpen ? 'flex' : 'none'}
    role="dialog"
    aria-modal="true"
    aria-label="In Kalender speichern"
    onclick={onBackdropClick}
    onkeydown={null}
    tabindex="-1"
  >
    <div class="calendar-modal__content">
      <h3>In Kalender speichern</h3>
      <p>Wähle deinen Kalender:</p>
      <div class="calendar-modal__buttons">
        <a
          href={googleUrl}
          class="btn btn--secondary"
          target="_blank"
          rel="noopener"
          onclick={trackGoogle}
        >
          Google Calendar
        </a>
        <a
          href={icsBlobUrl}
          class="btn btn--secondary"
          download="maennerkreis-straubing.ics"
          onclick={trackIcs}
        >
          Apple/Outlook (.ics)
        </a>
      </div>
    </div>
  </div>
</div>

<style>
  :global(.calendar-modal) {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal-backdrop);
    display: none;
    align-items: center;
    justify-content: center;
    background: var(--bg-overlay);
    backdrop-filter: blur(4px);
  }

  :global(.calendar-modal.open) {
    display: flex;
    animation: modal-backdrop-in var(--motion-standard);
  }

  :global(.calendar-modal__content) {
    max-inline-size: 380px;
    padding: var(--space-lg);
    margin: var(--space-md);
    text-align: center;
    background: var(--bg-primary);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-2xl);
    animation: modal-in var(--motion-enter);
  }

  :global(.calendar-modal__content h3) {
    margin-block-end: var(--space-sm);
    font-size: 1.375rem;
    letter-spacing: -0.02em;
  }

  :global(.calendar-modal__content p) {
    margin-block-end: var(--space-md);
    font-size: 0.9375rem;
    color: var(--text-secondary);
  }

  :global(.calendar-modal__buttons) {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }
</style>
