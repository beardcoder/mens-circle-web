<script lang="ts">
  import { isCoarsePointer } from '@lib/helpers';
  import type { Map as LeafletMap } from 'leaflet';
  import { onDestroy, onMount } from 'svelte';
  // Static import so Astro bundles Leaflet's CSS into the page styles. A
  // runtime `import('leaflet/dist/leaflet.css')` 404s under
  // `inlineStylesheets: 'always'` (the emitted .css asset is inlined into the
  // HTML and removed from disk), which left the map unstyled / broken.
  import 'leaflet/dist/leaflet.css';

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

      const { default: L } = await import('leaflet');

      if (disposed || !canvas) return;

      map = L.map(canvas, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      }).setView([lat, lng], 16);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' +
          ' &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);

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

<div class="event-map" data-state={state} aria-label="Karte zum Veranstaltungsort">
  <div bind:this={canvas} class="event-map__canvas" role="application" aria-label="Interaktive Karte"></div>
</div>

<style>
  /* @keyframes kept outside layer — unlayered for animation lookup */
  @keyframes event-map-skeleton {
    0%,
    100% {
      opacity: 0.5;
    }

    50% {
      opacity: 0.25;
    }
  }

  /* The section chrome (heading, spacing, action row) belongs to
     components/event/EventMapSection.astro now; this file styles the map
     itself. The sepia tile filter is gone with it — a filtered map is harder to
     read, and there was nothing for it to match any more. */

  :global(.event-map) {
    position: relative;
    display: block;
    block-size: 100%;
    overflow: hidden;
    background: var(--bg-secondary);
    contain: paint;
    isolation: isolate;
  }

  :global(.event-map[hidden]) {
    display: none;
  }

  :global(.event-map__canvas) {
    inline-size: 100%;
    /* The frame in EventMapSection.astro owns the aspect ratio; fill it. */
    block-size: 100%;
    min-block-size: 280px;
    background: var(--bg-secondary);
  }

  :global(.event-map[data-state='idle'] .event-map__canvas::before),
  :global(.event-map[data-state='loading'] .event-map__canvas::before) {
    position: absolute;
    inset: 0;
    pointer-events: none;
    content: '';
    background: repeating-linear-gradient(
      135deg,
      color-mix(in srgb, var(--border-light) 60%, transparent) 0 12px,
      transparent 12px 24px
    );
    animation: event-map-skeleton 2s var(--ease-ambient) infinite;
  }

  :global(.event-map__canvas:has(.leaflet-container)::before) {
    display: none;
  }

  :global(.event-map__marker) {
    border: 0;
    background: none;
  }

  :global(.event-map__marker svg) {
    inline-size: 100%;
    block-size: 100%;
    color: var(--accent-primary);
    fill: currentcolor;
  }

  :global(.event-map .leaflet-popup-content-wrapper) {
    color: var(--text-primary);
    font-family: var(--font-body);
    background: var(--bg-elevated);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
  }

  :global(.event-map .leaflet-popup-content) {
    margin: var(--space-xs) var(--space-sm);
    font-size: var(--text-caption);
    line-height: var(--leading-normal);
  }

  :global(.event-map .leaflet-popup-content strong) {
    display: inline-block;
    margin-block-end: var(--space-3xs);
    font-family: var(--font-display);
    font-size: var(--text-section-body);
    font-weight: 400;
  }

  :global(.event-map .leaflet-popup-tip) {
    background: var(--bg-elevated);
  }

  :global(.event-map__directions) {
    display: inline-block;
    margin-block-start: var(--space-xs);
    font-weight: 600;
    color: var(--accent-text);
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  :global(.event-map__directions:hover),
  :global(.event-map__directions:focus-visible) {
    color: var(--accent-rare);
  }

  :global(.event-map .leaflet-control-zoom a) {
    color: var(--text-primary);
    background: var(--bg-elevated);
    border: 1px solid var(--border-light);
  }

  :global(.event-map .leaflet-control-zoom a:hover),
  :global(.event-map .leaflet-control-zoom a:focus-visible) {
    background: var(--bg-secondary);
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.event-map[data-state='idle'] .event-map__canvas::before),
    :global(.event-map[data-state='loading'] .event-map__canvas::before) {
      animation: none;
    }
  }
</style>
