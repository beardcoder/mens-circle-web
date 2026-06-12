# Männerkreis Niederbayern / Straubing

Schnelle, leichtgewichtige Website für den Männerkreis — **Astro 6 + Svelte 5**,
**SSR in der Bun-Runtime** als schlanker Edge, **PocketBase** als Backend. Alles
zusammen in **einem** Docker-Image, deploybar mit Coolify. Paketmanager,
Build-Tool **und** Laufzeit ist **Bun**.

## Architektur

```
┌─────────────────────────── ein Docker-Container ───────────────────────────┐
│                                                                             │
│   Bun-Edge (server, :8090 — der nach außen exposte Port)                    │
│   ├─ liefert die Astro-Site aus:                                            │
│   │    · vorgerenderte Seiten (statisch) — Recht/Atemübung/…                │
│   │    · On-Demand-SSR — Startseite (Testimonials) + Event-Seiten,          │
│   │      die live aus PocketBase rendern (kein Rebuild nötig)               │
│   │    · setzt Cache-Control je Asset-Klasse + Security-Header              │
│   └─ reverse-proxyt die dynamischen Pfade an PocketBase:                     │
│        /api/*  ·  /_  ·  /_/*  ·  /newsletter/*                             │
│                          │                                                  │
│                          ▼                                                  │
│   PocketBase (Go-Binary, 127.0.0.1:8091 — nur intern)                       │
│   ├─ REST API + Admin-UI (/_/)                                              │
│   ├─ Custom-Routen (Anmeldung, Newsletter, …)     → pb_hooks/               │
│   ├─ Transaktionale E-Mails (Go-Templates)        → pb_hooks/views/emails/  │
│   ├─ Cron (Event-Erinnerungen)                    → pb_hooks/cron.pb.js     │
│   └─ Collections / Schema                         → pb_migrations/          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Bun-Edge statt nginx.** Ein einziger Bun-Prozess ist der öffentliche Edge:
  er rendert/liefert die Astro-Site und proxyt die dynamischen Pfade an
  PocketBase auf Loopback. Der Adapter dafür ist lokal und minimal
  ([`adapter/`](adapter/)) — die offiziellen Bun-Adapter unterstützen nur
  Astro ≤5. Cache-Control wird je Asset-Klasse gesetzt (gehashte Assets/Fonts
  `immutable` 1 Jahr, sonstige Bilder 7 Tage, Manifeste/Feeds 1 Tag, HTML
  `must-revalidate`), dazu Security-Header. Kompression übernimmt der
  Coolify-Edge.
- **RAM-schonend & nachhaltig.** Die meisten Seiten sind vorgerendert (statisch)
  und werden nur ausgeliefert; nur Event-Seiten und die Testimonials der
  Startseite rendern serverseitig live aus PocketBase. Ein kleiner In-Memory-
  Cache (60 s) hält die SSR-Abfragen niedrig. Ein Rebuild bei Content-Änderung
  entfällt komplett — neue Events/Testimonials sind sofort sichtbar.
- **Bun zur Laufzeit (nicht Node).** Das gebaute Server-Bundle wird mit `bun`
  ausgeführt. Footprint: ein Bun-Prozess + das PocketBase-Binary.
- **Statischer Content** (Texte, FAQ, Hero, Moderator …) liegt als **JSON** im
  Repo (`src/content/`, `src/data/`) und wird direkt in Astro eingepflegt.
- **Dynamische Teile** (Anmeldung, Warteliste, Newsletter, Testimonial,
  Atemübung) sind **Svelte-5-Islands**, die per `fetch` mit PocketBase sprechen.

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
adapter/          lokaler Astro-6-Bun-Adapter (Edge-Server + PocketBase-Proxy)
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
daher `PUBLIC_PB_URL`. In Produktion läuft alles same-origin hinter dem Bun-Edge:
der Browser spricht den Edge-Port an, der Edge proxyt `/api/*` an PocketBase —
dann bleibt `PUBLIC_PB_URL` leer. (Der Edge läuft nur im Docker-Image; lokal
nutzt man `bun run dev`.)

### Build & lokal ausführen

```bash
bun run build        # → dist/   (NICHT `bun --bun run build`, das bricht Rollup)

# Das gebaute Server-Bundle in der Bun-Runtime starten (wie in Produktion).
# Edge auf :3000, PocketBase (lokal auf :8090) als Datenquelle/Proxy-Ziel.
PORT=3000 PB_INTERNAL_URL=http://127.0.0.1:8090 bun run start
```

## Deployment mit Coolify

1. Neue Ressource → **Dockerfile**-basiert, dieses Repo.
2. **Persistent Volume** mounten auf `/pb/pb_data` (Datenbank + Uploads).
3. Port **8090** exposen (das ist der Bun-Edge; PocketBase läuft intern auf
   `127.0.0.1:8091`). Coolify terminiert TLS und leitet per HTTP weiter.
4. Environment-Variablen setzen (siehe `.env.example`):

| Variable                                                               | Zweck                                                            |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `APP_URL`                                                              | öffentliche URL (E-Mail-Links, iCal, Unsubscribe)               |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`                                  | Absender transaktionaler Mails                                  |
| `MAIL_ADMIN_ADDRESS`, `MAIL_ADMIN_NAME`                                | Empfänger der Admin-Benachrichtigungen                          |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_TLS` | SMTP-Versand (wird beim Boot in PocketBase übernommen)          |
| `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`                                  | legt beim ersten Start den Admin an                             |
| `PUBLIC_SITE_URL`                                                      | **Build-Arg**: Canonical/Sitemap (Default `https://mens-circle.de`) |
| `PUBLIC_UMAMI_ID`, `PUBLIC_UMAMI_ENDPOINT`                             | optional: Umami-Analytics                                       |

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
- **Events, Anmeldungen, Newsletter, Testimonials:** im PocketBase-Admin (`/_/`).

Nach Content-Änderungen am **JSON**: neu deployen (Coolify-Rebuild). **Events und
Testimonials** werden serverseitig (SSR) live aus PocketBase gerendert — eine
Änderung im PocketBase-Admin ist **sofort** sichtbar, ohne Rebuild. Auch
Anmeldungen/Kapazität sind dadurch immer live.

## E-Mails

Automatisch (PocketBase-Hooks): Anmeldebestätigung, Wartelisten-Bestätigung,
Admin-Benachrichtigung, Wartelisten-Nachrückung, Newsletter-Willkommen.
Geplant (Cron, alle 15 min): Event-Erinnerung (heute/morgen).
Batch (Admin-Route): Newsletter-Kampagne an alle aktiven Abonnenten.

Details: siehe [`pocketbase/README.md`](pocketbase/README.md).
