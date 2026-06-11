<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { isCoarsePointer } from '@lib/helpers';
  import type { Map as LeafletMap } from 'leaflet';

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
        (address ? '<br>' + escapeHtml(address) : '') +
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
