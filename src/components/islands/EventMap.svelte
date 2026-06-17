<script lang="ts">
import { isCoarsePointer } from '@lib/helpers';
import type { Map as LeafletMap } from 'leaflet';
import { onDestroy, onMount } from 'svelte';

interface Props {
  lat: number;
  lng: number;
  title: string;
  address: string;
}

const { lat, lng, title, address }: Props = $props();

let canvas: HTMLElement;
let state = $state<'idle' | 'loading' | 'ready'>('idle');
let map: LeafletMap | null = null;
let disposed = false;

function buildDirectionsUrl(): string {
  if (isCoarsePointer()) {
    const label = encodeURIComponent(address || title);
    return `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
  }
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

onMount(() => {
  let cleanupCanvas: (() => void) | undefined;

  void (async () => {
    state = 'loading';

    const [{ default: L }] = await Promise.all([
      import('leaflet'),
      import('leaflet/dist/leaflet.css'),
    ]);

    if (disposed || !canvas) return;

    map = L.map(canvas, {
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    }).setView([lat, lng], 16);

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' +
          ' &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    ).addTo(map);

    const icon = L.divIcon({
      className: 'event-map__marker',
      html:
        '<svg viewBox="0 0 32 44" aria-hidden="true" focusable="false">' +
        '<path d="M16 0C7.2 0 0 7 0 15.5 0 27 16 44 16 44s16-17 16-28.5C32 7 24.8 0 16 0z"/>' +
        '<circle cx="16" cy="15.5" r="6" fill="#fff"/>' +
        '</svg>',
      iconSize: [32, 44],
      iconAnchor: [16, 44],
      popupAnchor: [0, -40],
    });

    const popup =
      '<strong>' +
      escapeHtml(title) +
      '</strong>' +
      (address ? `<br>${escapeHtml(address)}` : '') +
      '<br><a class="event-map__directions" href="' +
      buildDirectionsUrl() +
      '" target="_blank" rel="noopener">Route planen</a>';

    L.marker([lat, lng], { icon }).addTo(map).bindPopup(popup);

    const enableZoom = (): void => {
      map?.scrollWheelZoom.enable();
    };
    const disableZoom = (): void => {
      map?.scrollWheelZoom.disable();
    };

    canvas.addEventListener('click', enableZoom);
    canvas.addEventListener('mouseleave', disableZoom);
    cleanupCanvas = (): void => {
      canvas.removeEventListener('click', enableZoom);
      canvas.removeEventListener('mouseleave', disableZoom);
    };

    state = 'ready';
  })();

  return () => {
    cleanupCanvas?.();
  };
});

onDestroy(() => {
  disposed = true;
  map?.remove();
  map = null;
});
</script>

<div
  class="event-map"
  data-state={state}
  aria-label="Karte zum Veranstaltungsort"
>
  <div
    bind:this={canvas}
    class="event-map__canvas"
    role="application"
    aria-label="Interaktive Karte"
  ></div>
</div>

<style>
  /* @keyframes kept outside layer — unlayered for animation lookup */
  @keyframes event-map-skeleton {
    0%,
    100% {
      opacity: 0.6;
    }

    50% {
      opacity: 0.3;
    }
  }

  :global(.event-map-section) {
    position: relative;
    background: var(--bg-secondary);
    padding: var(--space-2xl) 0;
    overflow: hidden;
  }

  :global(.event-map-section .event-map__header) {
    margin-block-end: var(--space-lg);
    text-align: center;
  }

  :global(.event-map-section .event-map__title) {
    margin-block: 0 var(--space-xs);
  }

  :global(.event-map-section .event-map__subtitle) {
    margin-inline: auto;
    max-inline-size: 60ch;
    color: var(--text-secondary);
  }

  :global(.event-map) {
    display: block;
    position: relative;
    contain: paint;
    box-shadow: 0 12px 40px -20px
      color-mix(in oklch, var(--color-ink) 30%, transparent);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    background: linear-gradient(
      135deg,
      color-mix(in oklch, var(--color-sand) 35%, transparent),
      color-mix(in oklch, var(--color-parchment) 60%, transparent)
    );
    isolation: isolate;
    overflow: hidden;
  }

  :global(.event-map[hidden]) {
    display: none;
  }

  :global(.event-map__canvas) {
    background: color-mix(
      in oklch,
      var(--color-sand-light) 50%,
      var(--color-parchment)
    );
    inline-size: 100%;
    block-size: clamp(320px, 50vh, 520px);
  }

  :global(.event-map[data-state='idle'] .event-map__canvas::before),
  :global(.event-map[data-state='loading'] .event-map__canvas::before) {
    position: absolute;
    animation: event-map-skeleton 2s var(--ease-ambient) infinite;
    inset: 0;
    background: repeating-linear-gradient(
      135deg,
      color-mix(in oklch, var(--color-sand) 25%, transparent) 0 12px,
      transparent 12px 24px
    );
    pointer-events: none;
    content: '';
  }

  :global(.event-map__canvas:has(.leaflet-container)::before) {
    display: none;
  }

  :global(.event-map__marker) {
    filter: drop-shadow(
      0 4px 6px color-mix(in oklch, var(--color-ink) 40%, transparent)
    );
    border: 0;
    background: none;
  }

  :global(.event-map__marker svg) {
    fill: currentcolor;
    inline-size: 100%;
    block-size: 100%;
    color: var(--color-terracotta);
  }

  :global(.event-map .leaflet-popup-content-wrapper) {
    box-shadow: 0 8px 24px -10px
      color-mix(in oklch, var(--color-ink) 40%, transparent);
    border-radius: var(--radius-md);
    background: var(--bg-elevated);
    color: var(--text-primary);
    font-family: var(--font-body);
  }

  :global(.event-map .leaflet-popup-content) {
    margin: var(--space-sm) var(--space-md);
    font-size: var(--text-body-compact);
    line-height: 1.5;
  }

  :global(.event-map .leaflet-popup-content strong) {
    display: inline-block;
    margin-block-end: var(--space-3xs);
    font-weight: 600;
    font-size: var(--text-section-body);
    font-family: var(--font-display);
  }

  :global(.event-map .leaflet-popup-tip) {
    background: var(--bg-elevated);
  }

  :global(.event-map__directions) {
    display: inline-block;
    margin-block-start: var(--space-xs);
    color: var(--accent-primary, var(--color-terracotta));
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  :global(.event-map__directions:hover),
  :global(.event-map__directions:focus-visible) {
    color: var(--color-terracotta);
  }

  :global(.event-map__actions) {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-sm);
    margin-block-start: var(--space-md);
  }

  :global(.event-map__attribution) {
    margin-block-start: var(--space-xs);
    color: var(--text-muted);
    font-size: var(--text-xs);
    text-align: center;
  }

  :global(.event-map__attribution a) {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  @media (width <= 640px) {
    :global(.event-map-section) {
      padding: var(--space-xl) 0;
    }

    :global(.event-map__canvas) {
      block-size: clamp(280px, 60vh, 420px);
    }
  }

  :global(.event-map .leaflet-tile-pane) {
    filter: sepia(12%) saturate(0.88) brightness(0.97);
  }

  :global(.event-map .leaflet-control-zoom a) {
    border: 1px solid var(--border-light);
    background: var(--bg-elevated);
    color: var(--text-primary);
  }

  :global(.event-map .leaflet-control-zoom a:hover),
  :global(.event-map .leaflet-control-zoom a:focus-visible) {
    background: var(--bg-secondary);
  }
</style>
