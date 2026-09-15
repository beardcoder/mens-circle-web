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

  /**
   * The basemap. CARTO's `basemaps.cartocdn.com` used to serve this and started
   * asking for an API key — the one thing a tile source for this site must not
   * do, since there is no account to hang a key on and a key in a client bundle
   * is public anyway.
   *
   * This is the Humanitarian style, rendered by the HOT team and hosted by
   * OpenStreetMap France: no key, no account, no quota to sign up for. It was
   * also the best fit of the keyless options — its ground is warm beige and it
   * draws few POI icons, where the standard OSM style paints blue cycle routes,
   * red retail labels and cyan shop pins across the frame. The design system is
   * explicit that the greys here are ochre-cast, never blue-cast.
   *
   * Two other keyless options, if this one ever has to be swapped (it is a
   * one-line change): `https://tile.openstreetmap.org/{z}/{x}/{y}.png` is the
   * standard style and the only keyless raster behind a real CDN (Fastly), at
   * the cost of the busier look; `https://tile.openstreetmap.de/{z}/{x}/{y}.png`
   * is the same style with German labels. Stadia and Wikimedia are NOT options
   * — they answer 401 and 403 respectively for third-party use.
   */
  const TILE_URL = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
  const TILE_SUBDOMAINS = 'abc';
  const TILE_MAX_ZOOM = 20;
  const TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' +
    ' &middot; Kacheln: <a href="https://www.hotosm.org/">HOT</a>' +
    ' / <a href="https://openstreetmap.fr/">OSM France</a>';

  /** How many tiles may fail before the map admits it cannot draw itself. One
   *  tile missing at the edge of a pan is noise; a whole screenful is an outage,
   *  and a grey box that says nothing is the worst of both. */
  const TILE_ERROR_LIMIT = 4;

  let canvas: HTMLElement;
  let state = $state<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  let map: LeafletMap | null = null;
  let disposed = false;
  let tileErrors = 0;

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

      const tiles = L.tileLayer(TILE_URL, {
        maxZoom: TILE_MAX_ZOOM,
        subdomains: TILE_SUBDOMAINS,
        attribution: TILE_ATTRIBUTION,
      });

      // Say so rather than showing an empty frame. The address and the route
      // links live in the section around this island, so a map that cannot
      // draw costs the reader nothing — a silent grey rectangle would have him
      // wondering whether the venue is the problem.
      tiles.on('tileerror', () => {
        tileErrors += 1;
        if (tileErrors >= TILE_ERROR_LIMIT && state !== 'failed') state = 'failed';
      });
      tiles.on('tileload', () => {
        tileErrors = 0;
      });

      tiles.addTo(map);

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

      if (state !== 'failed') state = 'ready';
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

  {#if state === 'failed'}
    <p class="event-map__fallback">
      Die Karte lässt sich gerade nicht laden. Die Adresse steht über dieser Box, und die Routen-Links darunter
      funktionieren weiterhin.
    </p>
  {/if}
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

  :global(.event-map[data-state='failed'] .event-map__canvas) {
    display: none;
  }

  /* The frame in EventMapSection.astro reserves a 16/9 box so a loading map
     cannot shift the page. Once there is no map to load, that box is just a
     large empty rectangle around one sentence — release it. */
  :global(.event-map__frame:has(.event-map[data-state='failed'])) {
    aspect-ratio: auto;
  }

  :global(.event-map__fallback) {
    padding: var(--space-sm);
    margin: 0;
    font-size: var(--text-caption);
    line-height: var(--leading-normal);
    color: var(--text-muted);
    text-wrap: balance;
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

  /* Leaflet ships its own attribution chrome: a translucent white box with
     #0078a8 links, which measures 3.3:1 on that box and is the only text on the
     site that fails. It is a required credit, so it has to be legible — put it
     on our own ground with our own colours. */
  :global(.event-map .leaflet-control-attribution) {
    font-family: var(--font-body);
    font-size: var(--text-caption);
    color: var(--text-muted);
    background: var(--bg-elevated);
    border-radius: 0;
  }

  :global(.event-map .leaflet-control-attribution a) {
    color: var(--text-primary);
    text-decoration: underline;
  }

  :global(.event-map .leaflet-popup-content-wrapper) {
    color: var(--text-primary);
    font-family: var(--font-body);
    background: var(--bg-elevated);
    border: 2px solid var(--rule-strong);
    border-radius: 0;
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
