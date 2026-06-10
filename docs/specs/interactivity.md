# Interactivity Specification

Source: Laravel project `mens-circle` (German men's circle landing page).
Target: rebuild as Astro 5 site with Svelte 5 islands / vanilla TS.

This document captures every client-side interactive behavior found in
`resources/js/` so it can be faithfully reimplemented.

---

## Architecture overview (source)

- The frontend layers small reactive components on top of server-rendered
  Blade output using **Lume** (`@beardcoder/lume` 0.9.0), a tiny custom-element /
  signal micro-framework. Components are registered by name and mounted; Lume
  owns listener teardown via a `cleanup()` callback and provides:
  - `root` — the component root element
  - `part(name)` / `parts(name)` — query single/multiple `[data-part="name"]` (or
    equivalent) descendants
  - `on(target, event, handler, opts)` — auto-cleaned event binding
  - `signal()` / `effect()` — fine-grained reactivity (used by calendar & breathing)
  - `cleanup(fn)` — teardown hook
- Entry point `app.ts` registers 7 components, then runs two page-level
  initializers (`initMotion`, `initUmamiKit`). Bootstrap waits for
  `DOMContentLoaded`.
- Filament admin uses its own Alpine integration outside this bundle (irrelevant
  to the rebuild).

Registered components (Lume names → file):

| Lume name | File | Purpose |
|---|---|---|
| `site-header` | `components/site-header.ts` | Sticky header + circle-reveal mobile menu + anchor scrolling |
| `newsletter-form` | `components/forms.ts` | Newsletter signup |
| `registration-form` | `components/forms.ts` | Event registration |
| `testimonial-form` | `components/forms.ts` | Testimonial submission + char counter |
| `calendar` | `components/calendar.ts` | "Add to calendar" modal (ICS + Google) |
| `event-map` | `components/event-map.ts` | Lazy Leaflet map |
| `breathing-app` | `components/breathing.ts` | Wim-Hof breathing exercise |

Page-level (not components): `utils/motion.ts` (scroll reveals),
`utils/umami-kit.ts` (engagement tracking).

---

## Frontend dependencies (from `package.json`)

Runtime:

| Package | Version | Used by | Notes for rebuild |
|---|---|---|---|
| `@beardcoder/lume` | 0.9.0 | all components | **Drop** — replaced by Svelte 5 / vanilla TS. |
| `motion` | ^12.40.0 | site-header, motion.ts | Keep. Uses `motion/mini` (`animate`, WAAPI-only) + `inView`. Latest major, fine for Astro. |
| `leaflet` | ^1.9.4 | event-map.ts | Keep, lazy-imported. Latest stable. `@types/leaflet` ^1.9.21 dev. |
| `tailwindcss` + `@tailwindcss/vite` | ^4.3.0 | styling | Keep; Tailwind v4 works with Astro 5 (`@tailwindcss/vite`). |

Dev/tooling (carry over selectively): `vite` ^8, `typescript` ^6, eslint 10 +
typescript-eslint, prettier 3 (+ blade/tailwind plugins — blade plugin drops),
stylelint 17, `@fontsource-variable/dm-sans` + `playfair-display`,
`laravel-vite-plugin` (drop), `concurrently`, `globals`. Package manager: `bun@1.3.14`.

**Latest-worthy for Astro+Svelte rebuild:** add `astro` 5, `svelte` 5,
`@astrojs/svelte`. `motion` and `leaflet` versions are current and can be reused
as-is. Tailwind v4 stays.

---

## Global window contract

Server-rendered Blade injects globals the JS reads. The Astro rebuild must
provide equivalents (props/env/`define:vars` instead of `window.*`):

```ts
window.routes: { newsletter: string; eventRegister: string }  // form endpoints
window.eventData?: EventData                                   // calendar fallback source
window.umami?: { track(name, data?) }                          // analytics script
window.umamiTracker?: UmamiKit                                 // set by initUmamiKit
```

`EventData = { title, description, location, startDate, startTime, endDate, endTime }`
(`types/index.ts`). `ApiResponse = { success: boolean; message: string }`.

In Astro, prefer passing `newsletter` / `eventRegister` URLs and event data as
island props rather than globals.

---

## 1. Site Header (`site-header.ts`)

### What it does
Sticky site header with three behaviors:
1. **Scroll state** — toggles `is-scrolled` on the header root once the page
   scrolls past 48px (or immediately if there is no `.hero` element). Also sets
   `has-hero` / `no-hero` on `<body>` once at init.
2. **Circle-reveal mobile menu** — tapping the toggle expands a full-screen panel
   via an animated `clip-path: circle()` growing from the button center to cover
   the viewport; nav items/meta cascade in with a staggered fade+rise; the
   hamburger morphs into an X. Closing inhales the circle back to the button.
   Body scroll is locked (`position` offset via `body.style.top` + `nav-open`
   class) and restored on close.
3. **In-page anchor scrolling** — nav links pointing at a `#fragment` on the
   current page are intercepted: smooth-scroll to the target offset by the
   header clearance, `history.pushState` the hash. If the menu is open, it
   closes first and scrolls to the anchor after the close animation settles.

### DOM/markup expected
- Component root = header element (gets `is-scrolled`).
- `part('nav')` → the panel `<nav>` (gets `is-open`, `clip-path` inline styles).
- `part('toggle')` → `<button>`; contains `.nav-toggle__bar` (3 bars). Gets
  `is-open`, `aria-expanded`, `aria-label` ("Menü öffnen/schließen").
- `parts('nav-link')` → anchor links inside nav.
- Inside nav: `.nav__item` and `.nav__meta` elements = the cascade `revealItems`.
- Optional `.hero` element anywhere in the document (presence affects scroll state).
- CSS custom property `--header-clearance` on `<html>` (anchor scroll offset;
  fallback 120px). Easing curves mirror `_variables.css`.
- Ambient "breathing" rings + idle toggle ring are **pure CSS** (not in JS),
  paused under reduced motion.

### Events / interactions
- `window` `scroll` (passive) → recompute scroll state.
- `toggle` `click` → open/close menu.
- each `nav-link` `click` → same-page anchor handling (preventDefault + scroll)
  or plain navigation (just closes menu).
- `document` `keydown` Escape → close menu if open.
- `cleanup` → stops the in-flight panel animation.

### Reduced motion
`prefersReducedMotion()` checked at every transition: skips clip-path animation
(uses `clip-path: none` + class), sets bar transforms directly, shows items
instantly, uses `behavior: 'instant'` for scroll.

### API calls
None.

### External libs
`motion/mini` `animate()` (WAAPI) for: toggle bar morph, link cascade
(staggered, `delay: 0.14 + i*0.06`), panel clip-path open (0.72s) / close (0.5s).

### Recommendation
**Svelte 5 island** (`client:load` — it's above the fold and owns body scroll
lock). Reasons: meaningful local state (`isOpen`, `scrollPosition`, animation
controls), several coordinated DOM mutations, keyboard handling. Svelte 5
`$state`/`$effect` map cleanly; keep `motion/mini` for the clip-path/cascade
animations (Svelte's built-in transitions can't easily do the circle reveal).
Anchor-scroll + scroll-state logic could alternatively be a small vanilla module
shared site-wide, but bundling it in the header island is simplest. Note the
ambient ring animation stays in CSS regardless.

---

## 2. Calendar "Add to calendar" (`calendar.ts`)

### What it does
On mount, builds an **ICS blob URL** and a **Google Calendar deep link** from
event data, then wires an "Add to calendar" button that opens a modal exposing
both download/link options. Fires Umami events on open and on each download.

### DOM/markup expected
- Root carries event data via `data-*` (preferred): `data-event-title`,
  `data-event-description`, `data-event-location`, `data-event-start-date`,
  `data-event-start-time`, `data-event-end-date`, `data-event-end-time`.
  Falls back to `window.eventData`, then a hardcoded `FALLBACK_EVENT`.
- `part('trigger')` → open button.
- `part('modal')` → modal container (toggled via `.open` class + inline
  `display: flex|none`).
- `part('google-url')` → anchor; `href` set to the Google Calendar URL.
- `part('ics-url')` → anchor; `href` set to the ICS blob URL.

### Events / interactions
- `trigger` click → open modal + track `calendar-open` `{ event: title }`.
- `modal` click on backdrop (target === modal) → close.
- `window` keydown Escape → close if open.
- `google-url` click → track `calendar-download-google`.
- `ics-url` click → track `calendar-download-ics`.
- `cleanup` → `URL.revokeObjectURL(icsBlobUrl)`.

### Data formats
- ICS: standard VCALENDAR/VEVENT, dates via `new Date(`${date}T${time}:00`)`
  → ISO basic format (`YYYYMMDDTHHMMSSZ`). UID = `Date.now()@maennerkreis-straubing.de`.
  PRODID `-//Männerkreis Niederbayern/ Straubing//DE`. Note: times are treated as
  local-parsed then `toISOString()` (UTC) — preserve this behavior or fix
  intentionally.
- Google URL: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=&dates=START/END&details=&location=&ctz=Europe/Berlin`,
  dates formatted `YYYYMMDDTHHMM00` (no Z, local).

### API calls
None.

### External libs
None.

### Recommendation
**Svelte 5 island** (`client:visible` or `client:idle` — below the fold,
interaction-gated). Modal open/close + blob-URL lifecycle + tracking is light
but stateful. The ICS/Google URL generation are pure functions — keep them as a
shared TS util (`lib/calendar.ts`) and import into the island. Generate the
blob URL in `onMount` and revoke in cleanup. Alternatively a `<dialog>`-based
vanilla component, but Svelte gives cleaner reactive `display` binding.

---

## 3. Event Map (`event-map.ts`)

### What it does
Lazy-loads Leaflet (~150 KB JS + CSS) **only when the map scrolls within 200px
of the viewport** (IntersectionObserver, `rootMargin: '200px'`), then renders an
OpenStreetMap tile map centered on the event coordinates with a custom SVG pin
marker and a popup containing title, address, and a "Route planen" directions
link. Scroll-wheel zoom is disabled until the user clicks the map, re-disabled on
mouse leave. Aborts cleanly if unmounted before Leaflet finishes loading.

### DOM/markup expected
- Root `data-lat`, `data-lng` (required, must parse to finite numbers — else
  `root.hidden = true` and component no-ops), `data-title`, `data-address`.
- Descendant `.event-map__canvas` (the Leaflet container).
- Root gets `data-state="loading"` then `data-state="ready"`.
- Marker is an `L.divIcon` with inline SVG (class `event-map__marker`); popup
  link class `event-map__directions`.

### Events / interactions
- IntersectionObserver entry → `initMap()` (once; disconnects).
- canvas `click` → enable scrollWheelZoom; `mouseleave` → disable.
- `cleanup` → disconnect observer; set `disposed`; `map.remove()`.

### Directions URL
- Coarse pointer (`isCoarsePointer()`): `geo:lat,lng?q=lat,lng(label)` (native maps).
- Otherwise: `https://www.openstreetmap.org/directions?to=lat%2Clng`.
- Popup HTML is hand-escaped via `escapeHtml()`.

### Tile / map config
- `L.map(container, { scrollWheelZoom: false, zoomControl: true, attributionControl: true }).setView([lat,lng], 16)`.
- Tiles: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, `maxZoom: 19`, OSM attribution.

### API calls
None (tiles fetched by Leaflet from OSM).

### External libs
`leaflet` ^1.9.4 (dynamic `import('leaflet')` + `import('leaflet/dist/leaflet.css')`).

### Recommendation
**Vanilla TS** (or a thin Svelte island wrapper). The logic is imperative
Leaflet setup with no reactive state — Svelte adds little. Best as a Svelte
island with `client:visible` (Astro's directive already does the lazy/in-view
loading the IntersectionObserver did manually — you can drop the hand-rolled
observer and let Astro hydrate on visibility, then dynamic-import Leaflet inside
`onMount`). Keep the dispose/abort guard for unmount safety. If staying fully
vanilla, replicate the IntersectionObserver lazy-load.

---

## 4. Breathing exercise (`breathing.ts`)

### What it does
Interactive Wim-Hof-style guided breathing session. State machine:
`idle → breathing → retention → recovery → [next round | complete]`.
- **breathing**: paced power breaths (cycle = 3600ms = 1800 inhale + 1800
  exhale); counts breaths up to the configured limit, then auto-advances to
  retention. A 1s timer tracks elapsed seconds.
- **retention**: open-ended breath hold; rAF-driven elapsed-seconds counter;
  user taps "Atem freigeben" to advance to recovery.
- **recovery**: fixed countdown (configurable seconds); on zero, either starts
  the next round's breathing or finishes if the round limit is reached. User can
  also tap "Weiteratmen" to advance early.
- **complete**: shows a closing message; start button becomes "Erneut starten".
- Settings (breaths via iOS-style swipe picker, rounds & recovery via +/-
  steppers) are **snapshotted into `session`** when a session starts — changing
  them mid-session does not affect the running round. Steppers/picker disabled
  while a session is active.

### DOM/markup expected (parts)
`circle`, `phase-label`, `counter`, `meta-round`, `meta-breath`, `meta-timer`,
`start` (button), `hold` (button), `reset` (button), `picker`, `picker-track`,
`rounds-value`, `rounds-minus`/`rounds-plus` (buttons), `recovery-value`,
`recovery-minus`/`recovery-plus` (buttons).
- Root gets `data-phase` and `--breathing-cycle-ms` CSS var; `circle` gets
  `data-motion` (`wave`/`hold-high`/`hold-low`) per phase (CSS drives the visual).
- Picker items are **generated in JS**: buttons `.breathing-picker__item` for
  values 10..60 step 5, width 72px each.

### Events / interactions
- `circle` click (when idle/complete) → start session.
- `start` click → start session; `reset` click → return to idle.
- `hold` click → retention→recovery, or recovery→next/complete.
- `rounds±` / `recovery±` clicks → adjust settings (clamped 1–6 / 5–30) when idle.
- Picker (`picker-track`): `pointerdown/move/up/cancel` drag with 4px threshold,
  `click` to select an item, `keydown` arrows/Home/End, `wheel` (horizontal,
  preventDefault). Uses `setPointerCapture`, `is-dragging` class, transform
  translate3d with cubic-bezier transition.

### Settings limits
breaths 10–60 (step 5, default 35); rounds 1–6 (default 3); recovery 5–30s
(default 15).

### Timers
`setInterval` (breath cadence), `setTimeout` (per-second ticks / recovery
countdown), `requestAnimationFrame` (retention loop). All cleared in
`clearScheduled()`; `cleanup` calls it.

### API calls
None.

### External libs
None (only `clamp` helper). Visual circle animation is CSS-driven via `data-*`.

### Recommendation
**Svelte 5 island** (`client:visible` — below the fold, heavy state). This is the
strongest island candidate: a real state machine with many `signal`/`effect`
pairs that map 1:1 to Svelte 5 `$state`/`$derived`/`$effect`. The swipe picker
(`setupPicker`) is self-contained pointer/keyboard/wheel logic — keep it as a
sub-component or an action (`use:picker`). Preserve the snapshot-on-start
semantics and the timer cleanup. No external deps needed.

---

## 5. Forms (`forms.ts`) — newsletter, registration, testimonial

All three share `createFormHandler` factory. The component **root must be the
`<form>` element**.

### Common behavior
- Tracks first interaction time (`input`/`change`).
- **Abandonment tracking**: on `pagehide` / `beforeunload` (capture), if the user
  filled all required fields but never submitted, fires `*-abandon-filled` with
  completion stats (required filled/total, %, filled/total fields, seconds since
  first input, page).
- **Submit** (capture phase): `preventDefault`; build+validate payload (returns
  `null` to abort with a toast); fire `*-submit`; disable submit button + set
  text "Wird gesendet..."; `fetch` POST JSON; parse `ApiResponse`.
  - `data.success` → `form.reset()`, success toast (`data.message`), `*-success`,
    optional `onSuccess`.
  - else → error toast (`data.message`), `*-error` `{ error: message }`.
  - network/exception → generic German error toast, `*-error`. Ignores aborts.
  - finally → restore button label + enabled.
- `cleanup` → `AbortController.abort()` cancels in-flight request.

### Fetch contract (all three)
```
POST <url>
Headers: Content-Type: application/json, Accept: application/json
Body: JSON.stringify(payload)
Signal: AbortController
Response: { success: boolean, message: string }   // shown verbatim in toast
```
No CSRF token / cookies are explicitly set (relies on session cookie / route
being CSRF-exempt server-side — **verify on the new backend**).

### 5a. Newsletter
- **URL**: `window.routes.newsletter`.
- **Payload**: `{ email }`. Validates `isValidEmail`; else error toast, abort.
- Events: `newsletter-submit/success/error/abandon-filled`.

### 5b. Event registration
- **URL**: `window.routes.eventRegister`.
- **Fields** (FormData): `first_name`, `last_name`, `email`, `phone_number`,
  `event_id`, `privacy` checkbox (`input[name="privacy"]`).
- **Payload**: `{ event_id, first_name, last_name, email, phone_number|null, privacy: 1 }`.
- **Validation**: first+last required; valid email; privacy checked. Each fails
  with a specific German toast and aborts.
- `submitMeta`: `{ event_id, has_phone: yes|no }`.
- Events: `event-registration-*`.

### 5c. Testimonial
- **URL**: `form.dataset.submitUrl` (per-form `data-submit-url`).
- **Fields**: `quote`, `author_name`, `role`, `email`, `privacy` checkbox.
- **Payload**: `{ quote, author_name|null, role|null, email, privacy: 1 }`.
- **Validation**: quote ≥10 chars; valid email; privacy checked.
- `submitMeta`: `{ has_name, has_role, char_count }`.
- **Extra**: live character counter — `part('char-count')` text bound to
  `part('quote-input')` textarea length on `input`; reset re-zeros after one tick.
- Events: `testimonial-*`.

### External libs
None (`fetch`, `isValidEmail`, `showToast`, `trackEvent`).

### Recommendation
**Svelte 5 islands**, one per form (`client:visible` / `client:idle`). The shared
`createFormHandler` should become a shared Svelte util/composable or a `use:` 
action that takes the per-form config (url, buildPayload, events). Toasts and
tracking stay as imported TS utils. Keep progressive enhancement in mind: the
`<form>` is server-rendered, so the island enhances an already-working form
(consider an `action`/method fallback on the new backend). Char counter is
trivially `$derived` in the testimonial island. **Action item**: replace
`window.routes` / `data-submit-url` with island props pointing at the new API
endpoints.

---

## 6. Page-level: Scroll reveals (`motion.ts`)

### What it does
Scroll-triggered entrance animations for any `[data-reveal]` element using
Motion's `inView` (single shared IntersectionObserver) + `motion/mini`
`animate()` (WAAPI). Variants: `up` (default), `down`, `left`, `right`, `fade`,
`zoom`, `blur`. Auto-stagger children of `[data-reveal-group]`. Per-element
`data-reveal-delay` / `data-reveal-duration` (ms) overrides; `data-reveal-repeat`
re-plays on every viewport entry (and reverses on exit).

### DOM/markup
`[data-reveal]`, `[data-reveal="variant"]`, `[data-reveal-group]`/`="ms"`,
`[data-reveal-delay]`, `[data-reveal-duration]`, `[data-reveal-repeat]`. Hidden
start state lives in CSS gated behind `.motion-ready` on `<html>` and
`prefers-reduced-motion: no-preference` (no FOUC, graceful no-JS / reduced-motion).

### Behavior details
- Reduced motion → returns early (no observers; content already visible per CSS).
- Mobile (`width < 640px`) vs desktop tuning (shift/zoom/blur/duration/step);
  mobile drops blur to avoid scroll jank.
- `inView` margin `0px 0px -12% 0px`, `amount: 'some'`. `will-change` promoted
  only during each animation, dropped on `finished`.

### External libs
`motion` (`inView`) + `motion/mini` (`animate`) ^12.40.0.

### Recommendation
**Vanilla TS**, site-wide. This is a global DOM scanner with no per-component
state — run it once after hydration (an Astro client script / a single
`client:idle` script, or a Svelte action `use:reveal` if you prefer
component-scoped). The `.motion-ready` CSS gating must be ported so SSR content
isn't hidden when JS is off. Keep `motion`/`motion/mini`. Reasonable to keep
almost verbatim.

---

## 7. Page-level: Umami engagement tracking (`umami-kit.ts` + `umami.ts`)

### What it does
`initUmamiKit()` waits for the global `window.umami` script (polls up to 80×100ms)
then sets up engagement tracking, all under one `AbortController`:
- **Scroll depth** checkpoints (25/50/75/90/100%, debounced 120ms), fires once each.
- **Time on page** heartbeat every 30s (skipped while idle).
- **Idle/active**: 6 activity events; idle after 60s → `user-idle`, returning →
  `user-active` with idle duration.
- **Click tracking**: optional `[data-umami-track]` (off by default); always
  tracks external-link clicks (`external-link`) unless link has `data-umami-event`.
- **Section visibility**: `section[id]` (or `[data-umami-visible]`) via
  IntersectionObserver (threshold 0.5), once each → `section-visible`.
- **Page exit**: `pagehide`/`beforeunload` → `page-exit` with time + max scroll.
Exposed as `window.umamiTracker` with `destroy()` and `getStats()`.

`umami.ts`: `trackEvent(name, data?)` — safe wrapper around `window.umami.track`,
no-op (debug log in DEV) if Umami absent. `TRACKING_EVENTS` const map of all
event names. `UmamiEventData` type.

### DOM/markup
`section[id]`, optional `[data-umami-track]`, `[data-umami-visible]`,
`[data-umami-data-*]` (collected as event metadata), `[data-umami-event]`
(opt-out of external-link tracking).

### External libs
None (depends on the external Umami `<script>` providing `window.umami`).

### Recommendation
**Vanilla TS**, site-wide. Pure analytics side-effect, zero UI/state — init once
after hydration (Astro client script / `client:idle`). Keep `trackEvent` +
`TRACKING_EVENTS` as a shared util imported by the form/calendar islands. Port
nearly verbatim. Ensure it runs on each Astro page navigation if using
view transitions (re-init or guard against double-binding).

---

## 8. Utilities

| File | Exports | Notes |
|---|---|---|
| `utils/helpers.ts` | `isValidEmail`, `clamp`, `isCoarsePointer`, `prefersReducedMotion` | Pure, port verbatim as shared lib. |
| `utils/toast.ts` | `showToast(type, message, title?)` | Appends a `.toast` div to `<body>`; entry/exit motion is CSS (`@starting-style` + `.toast--hiding`); auto-dismiss 5s, 400ms exit fallback. Vanilla, port verbatim (could be a small Svelte store + portal, but DOM-append is fine). |
| `utils/umami.ts` | `trackEvent`, `TRACKING_EVENTS`, `UmamiEventData` | Shared util. |

---

## Svelte-vs-vanilla summary

| Feature | Recommendation | Hydration hint |
|---|---|---|
| Site header / mobile menu | **Svelte island** (+ keep `motion/mini`) | `client:load` |
| Calendar modal | **Svelte island** (pure ICS/Google util extracted) | `client:visible`/`client:idle` |
| Event map | **Svelte island wrapper** over Leaflet (or vanilla) | `client:visible` (drops hand-rolled IO) |
| Breathing exercise | **Svelte island** (state machine + picker sub-component/action) | `client:visible` |
| Forms (×3) | **Svelte islands** (shared handler composable/action) | `client:visible`/`client:idle` |
| Scroll reveals (`motion.ts`) | **Vanilla TS** site-wide (keep `motion`) | one-time script / `client:idle` |
| Umami kit + trackEvent | **Vanilla TS** site-wide | one-time script / `client:idle` |
| toast / helpers | **Vanilla TS** shared utils | n/a |

### Cross-cutting action items for the rebuild
1. Replace `window.routes` / `window.eventData` / `form[data-submit-url]` with
   **island props** sourced from Astro frontmatter / env.
2. Verify the new form endpoints' **CSRF handling** — current code sends no token.
3. Port the `.motion-ready` and `prefers-reduced-motion` **CSS gating** so SSR
   content is never hidden without JS.
4. Keep all `motion/mini` animations (clip-path reveal, cascade, scroll reveals)
   — Svelte's built-in transitions can't replicate the circle clip-path.
5. If using Astro **view transitions**, re-init `motion`/`umami-kit` per
   navigation and guard against duplicate listeners.
6. Drop `@beardcoder/lume` and `laravel-vite-plugin`; add `astro`, `svelte`,
   `@astrojs/svelte`.
