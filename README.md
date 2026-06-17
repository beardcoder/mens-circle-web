# Männerkreis Niederbayern / Straubing

Schnelle, leichtgewichtige Website für den Männerkreis — **Astro 6 + Svelte 5**,
**SSR in der Bun-Runtime**, **PocketBase** als Backend. Der Bun-Server ist selbst
der öffentliche Edge (kein nginx). Alles zusammen in **einem** Docker-Image,
deploybar mit Coolify. Paketmanager, Build-Tool **und** Laufzeit ist **Bun**.

## Architektur

```
┌─────────────────────────── ein Docker-Container ───────────────────────────┐
│                                                                             │
│   Astro-Server (Bun, Edge, :8090 — der nach außen exposte Port)             │
│   ├─ liefert statische Assets + vorgerenderte HTML direkt  → /app/dist/client│
│   │    (gehashte Assets immutable, Security-Header)                         │
│   ├─ On-Demand-SSR: Startseite (Testimonials) + Event-Seiten, live aus PB   │
│   └─ /api · /_   → proxyt an PocketBase                                     │
│                                           │                                 │
│                                           ▼                                 │
│                                        PocketBase (Go, 127.0.0.1:8091)      │
│                                        ├─ REST API + Admin-UI (/_/)         │
│                                        ├─ Custom-Routen      → pb_hooks/     │
│                                        ├─ Transakt. E-Mails  → views/emails/│
│                                        ├─ Cron               → cron.pb.js    │
│                                        └─ Schema             → pb_migrations/│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Bun-Server als Edge.** Ein einziger Bun-Prozess ist der öffentliche
  Einstieg: er liefert die gehashten Assets **und die vorgerenderten
  HTML-Seiten** direkt von Platte aus (volle Kontrolle über Cache-Control je
  Asset-Klasse — gehashte Assets/Fonts `immutable` 1 Jahr, Bilder 7 Tage,
  Manifeste/Feeds 1 Tag, HTML `must-revalidate` — plus Security-Header), rendert
  die SSR-Routen (Startseite, Event-Seiten) on demand und proxyt die
  PocketBase-Pfade `/api · /_` an den Loopback-Upstream. Logik dafür im Adapter
  ([`adapter/server.mjs`](adapter/server.mjs)). Kompression + TLS übernimmt der
  Coolify-Edge.
- **Astro-Server in der Bun-Runtime (nicht Node).** Das gebaute Server-Bundle
  läuft mit `bun --smol` (kleiner Heap → wenig RAM) auf dem exposten Port
  (`:8090`). Der Adapter dafür ist lokal und minimal ([`adapter/`](adapter/)) —
  die offiziellen Bun-Adapter unterstützen nur Astro ≤5.
- **RAM-schonend & nachhaltig.** Die meisten Seiten sind vorgerendert (statisch)
  und werden direkt von Platte ausgeliefert; nur Event-Seiten und die
  Testimonials der Startseite rendern serverseitig live aus PocketBase. Ein
  kleiner In-Memory-Cache (60 s) hält die SSR-Abfragen niedrig. Ein Rebuild bei
  Content-Änderung entfällt komplett — neue Events/Testimonials sind sofort
  sichtbar.
- **Statischer Content** (Texte, FAQ, Hero, Moderator …) liegt als **JSON** im
  Repo (`src/content/`, `src/data/`) und wird direkt in Astro eingepflegt.
- **Dynamische Teile** (Anmeldung, Warteliste, Newsletter, Testimonial,
  Atemübung) sind **Svelte-5-Islands**, die per `fetch` mit PocketBase sprechen.
- **Newsletter über listmonk.** Abonnenten und Kampagnen liegen in einer
  externen [listmonk](https://listmonk.app)-Instanz, nicht mehr in PocketBase.
  Das Anmeldeformular postet weiterhin an `/api/newsletter/subscribe`; die
  PocketBase-Route leitet die Anmeldung an die listmonk-Admin-API weiter.
  Double-Opt-In, Versand und Abmeldung übernimmt listmonk (Config:
  `LISTMONK_URL`, `LISTMONK_API_USER`, `LISTMONK_API_TOKEN`, `LISTMONK_LIST_IDS`).

## Projektstruktur

```
src/
  content/        home.json (Block-Reihenfolge + Texte), legal/*.json
  data/           site.json, navigation.json, testimonials.json
  components/      Astro-Blöcke (Hero, Intro, FAQ …), Header, Footer, SEO
  components/islands/  Svelte-5-Islands (Formulare, Breathing, Event, Map …)
  lib/            PocketBase-Client, Utils (toast, motion, umami, calendar …)
  pages/          index, event, atemuebung, teile-deine-erfahrung, [slug]
  styles/         vollständiges CSS-Designsystem (OKLCH, @layer, kein Tailwind)
pocketbase/
  pb_migrations/  Collection-Schema (events, registrations, …)
  pb_hooks/       E-Mail-Logik, Custom-Routen, Cron, Templates
adapter/          lokaler Astro-6-Bun-Adapter (Server-Entrypoint: Edge, SSR, PB-Proxy)
Dockerfile        Multi-Stage: Bun-Build → Bun-Runtime + PocketBase
```

## Lokale Entwicklung

Voraussetzungen: [Bun](https://bun.sh) ≥ 1.3.

```bash
bun install

# 1) PocketBase-Binary einmalig holen (Version frei wählbar)
#    https://github.com/pocketbase/pocketbase/releases
#    entpacken nach ./pocketbase/pocketbase

# 2) Backend starten (Port 8090, Admin unter http://localhost:8090/_/)
./pocketbase/pocketbase serve \
  --dir ./pocketbase/pb_data \
  --hooksDir ./pocketbase/pb_hooks \
  --migrationsDir ./pocketbase/pb_migrations

# 3) Frontend-Dev-Server (Port 4321)
echo "PUBLIC_PB_URL=http://localhost:8090" > .env
bun run dev
```

Im Dev-Modus sprechen Astro (4321) und PocketBase (8090) über verschiedene Ports,
daher `PUBLIC_PB_URL`. In Produktion läuft alles same-origin über den Bun-Server:
der Browser spricht den exposten Port an, der Bun-Server proxyt `/api/*` an
PocketBase — dann bleibt `PUBLIC_PB_URL` leer. (Den Proxy gibt es nur im
Server-Bundle; lokal nutzt man `bun run dev`.)

### Build & lokal ausführen

```bash
bun run build        # → dist/   (NICHT `bun --bun run build`, das bricht Rollup)

# Den gebauten Astro-Server in der Bun-Runtime starten (wie in Produktion).
# Liefert statische + SSR-Seiten, proxyt /api · /_ an PocketBase und holt
# SSR-Daten aus PocketBase — beides über PB_INTERNAL_URL.
PORT=3000 PB_INTERNAL_URL=http://127.0.0.1:8090 bun run start
```

## Deployment mit Coolify

1. Neue Ressource → **Dockerfile**-basiert, dieses Repo.
2. **Persistent Volume** mounten auf `/pb/pb_data` (Datenbank + Uploads).
3. Port **8090** exposen (das ist der Bun-Server/Edge; PocketBase läuft intern
   auf `127.0.0.1:8091`). Coolify terminiert TLS und leitet per HTTP weiter.
4. Environment-Variablen setzen (siehe `.env.example`):

| Variable                                                               | Zweck                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `APP_URL`                                                              | öffentliche URL (E-Mail-Links, iCal, Unsubscribe)                   |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`                                  | Absender transaktionaler Mails                                      |
| `MAIL_ADMIN_ADDRESS`, `MAIL_ADMIN_NAME`                                | Empfänger der Admin-Benachrichtigungen                              |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_TLS` | SMTP-Versand (wird beim Boot in PocketBase übernommen)              |
| `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`                                  | legt beim ersten Start den Admin an                                 |
| `PUBLIC_SITE_URL`                                                      | **Build-Arg**: Canonical/Sitemap (Default `https://mens-circle.de`) |
| `PUBLIC_UMAMI_ID`, `PUBLIC_UMAMI_ENDPOINT`                             | optional: Umami-Analytics                                           |

SMTP/Absender werden bei jedem Boot aus den Env-Variablen in die PocketBase-
Einstellungen geschrieben — kein manuelles Klicken im Admin nötig. `PB_INTERNAL_URL`
setzt der Entrypoint automatisch auf die Loopback-Adresse — nicht nötig zu setzen.

Die PocketBase-Version ist als Docker-`ARG PB_VERSION` (Default aktuell
`0.39.3`) überschreibbar.

## Content pflegen

- **Startseiten-Texte / Block-Reihenfolge:** `src/content/home.json`
- **Globale Einstellungen** (Name, Social-Links, WhatsApp-Link, Footer):
  `src/data/site.json`
- **Navigation:** `src/data/navigation.json`
- **Impressum / Datenschutz:** `src/content/legal/*.json`
- **Events, Anmeldungen, Testimonials:** im PocketBase-Admin (`/_/`).
- **Newsletter (Abonnenten + Kampagnen):** im listmonk-Admin der externen Instanz.

Nach Content-Änderungen am **JSON**: neu deployen (Coolify-Rebuild). **Events und
Testimonials** werden serverseitig (SSR) live aus PocketBase gerendert — eine
Änderung im PocketBase-Admin ist **sofort** sichtbar, ohne Rebuild. Auch
Anmeldungen/Kapazität sind dadurch immer live.

## E-Mails

Automatisch (PocketBase-Hooks): Anmeldebestätigung, Wartelisten-Bestätigung,
Admin-Benachrichtigung, Wartelisten-Nachrückung.
Geplant (Cron, alle 15 min): Event-Erinnerung (heute/morgen).
Newsletter (Willkommen/Double-Opt-In + Kampagnen): über listmonk, nicht PocketBase.

Details: siehe [`pocketbase/README.md`](pocketbase/README.md).
