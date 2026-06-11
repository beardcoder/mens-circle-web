<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { trackEvent, TRACKING_EVENTS } from '@lib/umami';
  import { buildIcsBlobUrl, buildGoogleCalendarUrl } from '@lib/calendar';
  import type { EventData } from '@lib/types';

  interface Props {
    event: EventData;
  }

  const { event }: Props = $props();

  let isOpen = $state(false);
  let icsBlobUrl = $state('');
  const googleUrl = $derived(buildGoogleCalendarUrl(event));

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
