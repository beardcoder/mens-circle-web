<script lang="ts">
import type { EventData } from '@lib/types';
import { TRACKING_EVENTS, trackEvent } from '@lib/umami';
import { onDestroy, onMount } from 'svelte';

interface Props {
  event: EventData;
}

const { event }: Props = $props();

let dialogEl = $state<HTMLDialogElement>();
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
//
// Native <dialog> + showModal() gives us, for free, the things a hand-rolled
// role="dialog" never quite gets right: a focus trap, focus restoration to
// the trigger on close, Escape-to-dismiss, an inert background and top-layer
// rendering (no z-index battles). The open/close transition itself is pure
// CSS — `@starting-style` rises the card in, `allow-discrete` on `display` +
// `overlay` lets it fall back out instead of snapping shut.

onMount(() => {
  icsBlobUrl = buildIcsBlobUrl(event);
});

onDestroy(() => {
  if (icsBlobUrl) URL.revokeObjectURL(icsBlobUrl);
});

function open(): void {
  if (!dialogEl || dialogEl.open) return;
  dialogEl.showModal();
  trackEvent(TRACKING_EVENTS.CALENDAR_OPEN, { event: event.title });
}

function close(): void {
  dialogEl?.close();
}

// A click whose coordinates fall outside the dialog's box is a backdrop
// click (the ::backdrop pseudo still targets the dialog element). Clicks on
// the card itself land inside the rect and are ignored.
function onBackdropClick(e: MouseEvent): void {
  if (!dialogEl || e.target !== dialogEl) return;

  const r = dialogEl.getBoundingClientRect();
  const inside =
    e.clientX >= r.left &&
    e.clientX <= r.right &&
    e.clientY >= r.top &&
    e.clientY <= r.bottom;

  if (!inside) close();
}

function trackGoogle(): void {
  trackEvent(TRACKING_EVENTS.CALENDAR_DOWNLOAD_GOOGLE, {
    event: event.title,
  });
  close();
}

function trackIcs(): void {
  trackEvent(TRACKING_EVENTS.CALENDAR_DOWNLOAD_ICS, { event: event.title });
  close();
}
</script>

<div class="event-info__calendar">
  <button type="button" class="btn btn--secondary" onclick={open}>
    <svg class="icon" aria-hidden="true" focusable="false"
      ><use href="#icon-calendar"></use></svg
    >
    In Kalender speichern
  </button>

  <dialog
    bind:this={dialogEl}
    class="calendar-modal"
    aria-labelledby="calendar-modal-title"
    onclick={onBackdropClick}
  >
    <div class="calendar-modal__content">
      <button
        type="button"
        class="calendar-modal__close"
        aria-label="Schließen"
        onclick={close}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M6 6l12 12M18 6L6 18"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>

      <h3 id="calendar-modal-title">In Kalender speichern</h3>
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
  </dialog>
</div>

<style>
  /* The dialog *is* the card — centred in the top layer, animated in and out.
     Styles are global so the [open] state, ::backdrop and @starting-style
     resolve without Svelte's scope class interfering with the pseudo-element. */
  :global(.calendar-modal) {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    inline-size: min(380px, calc(100vw - 2 * var(--space-md)));
    max-block-size: calc(100dvh - 2 * var(--space-md));
    padding: 0;
    margin: auto;
    color: var(--text-primary);
    background: var(--bg-primary);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-2xl);

    /* Closed / pre-open resting state */
    opacity: 0;
    scale: 0.96;
    translate: 0 12px;
    transition:
      opacity var(--motion-standard),
      scale var(--motion-standard),
      translate var(--motion-standard),
      overlay var(--motion-standard) allow-discrete,
      display var(--motion-standard) allow-discrete;
  }

  :global(.calendar-modal[open]) {
    opacity: 1;
    scale: 1;
    translate: 0 0;
  }

  /* Enter: animate up from this snapshot to the [open] rules above. */
  @starting-style {
    :global(.calendar-modal[open]) {
      opacity: 0;
      scale: 0.96;
      translate: 0 12px;
    }
  }

  :global(.calendar-modal::backdrop) {
    background-color: color-mix(in oklch, var(--color-ink) 0%, transparent);
    backdrop-filter: blur(0);
    transition:
      background-color var(--motion-standard),
      backdrop-filter var(--motion-standard),
      overlay var(--motion-standard) allow-discrete,
      display var(--motion-standard) allow-discrete;
  }

  :global(.calendar-modal[open]::backdrop) {
    background-color: var(--bg-overlay);
    backdrop-filter: blur(4px);
  }

  @starting-style {
    :global(.calendar-modal[open]::backdrop) {
      background-color: color-mix(in oklch, var(--color-ink) 0%, transparent);
      backdrop-filter: blur(0);
    }
  }

  :global(.calendar-modal__content) {
    position: relative;
    padding: var(--space-lg);
    text-align: center;
  }

  :global(.calendar-modal__close) {
    position: absolute;
    inset-block-start: var(--space-xs);
    inset-inline-end: var(--space-xs);
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    color: var(--text-muted);
    cursor: pointer;
    background: none;
    border: none;
    border-radius: var(--radius-full);
    transition:
      color var(--motion-quick),
      background-color var(--motion-quick);
  }

  @media (hover: hover) and (pointer: fine) {
    :global(.calendar-modal__close:hover) {
      color: var(--text-primary);
      background: color-mix(in oklch, var(--text-primary) 8%, transparent);
    }
  }

  :global(.calendar-modal__close:focus-visible) {
    outline: 2px solid var(--accent-primary);
    outline-offset: 2px;
  }

  :global(.calendar-modal__close svg) {
    inline-size: 1.25rem;
    block-size: 1.25rem;
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

  @media (prefers-reduced-motion: reduce) {
    :global(.calendar-modal) {
      scale: 1;
      translate: 0;
      transition:
        opacity var(--motion-quick),
        overlay var(--motion-quick) allow-discrete,
        display var(--motion-quick) allow-discrete;
    }

    @starting-style {
      :global(.calendar-modal[open]) {
        scale: 1;
        translate: 0;
      }
    }

    :global(.calendar-modal::backdrop) {
      backdrop-filter: none;
    }

    :global(.calendar-modal[open]::backdrop) {
      backdrop-filter: none;
    }
  }
</style>
