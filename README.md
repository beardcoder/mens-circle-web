# Männerkreis Niederbayern / Straubing

Schnelle, leichtgewichtige Website für den Männerkreis — **Astro 6 + Svelte 5**,
**SSR in der Bun-Runtime**, **EmDash** (bun:sqlite) als eingebettetes Backend.
Alles in **einem** Bun-Prozess, deploybar mit Coolify als Docker-Image.
Paketmanager, Build-Tool **und** Laufzeit ist **Bun**.

## Architektur

```
┌─────────────────────────── ein Docker-Container ───────────────────────────┐
│                                                                             │
│   Bun-Server (:4321 — der nach außen exposte Port)                          │
│   ├─ liefert die statischen Assets direkt aus  → /app/dist/client           │
│   │    (gehashte Assets immutable, Security-Header)                         │
│   ├─ /api/* · /newsletter/*   → EmDash API (bun:sqlite)                     │
│   └─ alles andere (HTML/SSR)  → Astro SSR                                   │
│                                                                             │
│   ┌──────────────────────────────────────┐                                  │
│   │ EmDash (eingebettetes Backend)        │                                  │
│   │ ├─ SQLite-Datenbank (bun:sqlite)     │                                  │
│   │ ├─ API-Routen (Register, Newsletter) │                                  │
│   │ ├─ Transaktionale E-Mails (SMTP)     │                                  │
│   │ └─ Cron (Event-Erinnerungen)         │                                  │
│   └──────────────────────────────────────┘                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Ein Bun-Prozess für alles.** Kein nginx, kein PocketBase, kein Go — ein
  einziger Bun-Prozess bedient statische Assets, SSR-Seiten und die API. Die
  Datenbank ist eine SQLite-Datei via `bun:sqlite` (WAL-Modus, schnell, null
  Overhead).
- **Astro-Server in der Bun-Runtime (nicht Node).** Das gebaute Server-Bundle
  läuft mit `bun --smol` (kleiner Heap → wenig RAM). Der Adapter dafür ist
  lokal und minimal ([`adapter/`](adapter/)) — die offiziellen Bun-Adapter
  unterstützen nur Astro ≤5.
- **RAM-schonend & nachhaltig.** Die meisten Seiten sind vorgerendert (statisch);
  nur Event-Seiten und die Testimonials der Startseite rendern serverseitig live
  aus der SQLite-DB. Ein kleiner In-Memory-Cache (60 s) hält die SSR-Abfragen
  niedrig.
- **Statischer Content** (Texte, FAQ, Hero, Moderator …) liegt als **JSON** im
  Repo (`src/content/`, `src/data/`) und wird direkt in Astro eingepflegt.
- **Dynamische Teile** (Anmeldung, Warteliste, Newsletter, Testimonial,
  Atemübung) sind **Svelte-5-Islands**, die per `fetch` mit den EmDash-API-Routen
  sprechen.

## Projektstruktur

```
src/
  content/        home.json (Block-Reihenfolge + Texte), legal/*.json
  data/           site.json, navigation.json, testimonials.json
  components/      Astro-Blöcke (Hero, Intro, FAQ …), Header, Footer, SEO
  components/islands/  Svelte-5-Islands (Formulare, Breathing, Event, Map …)
  lib/            API-Client, Utils (toast, motion, umami, calendar …)
  pages/          index, event, atemuebung, teile-deine-erfahrung, [slug]
  styles/         vollständiges CSS-Designsystem (OKLCH, @layer, kein Tailwind)
server/
  db.ts           SQLite-Schema + Migrations (bun:sqlite)
  api.ts          API-Routen (Register, Newsletter, Testimonial, Events)
  lib.ts          Shared Utils (E-Mail-Templates, ICS, Formatter)
  mailer.ts       SMTP-Transport
  cron.ts         Hintergrund-Jobs (Event-Erinnerungen alle 15 Min)
adapter/          lokaler Astro-6-Bun-Adapter (Server-Entrypoint für die Runtime)
Dockerfile        Multi-Stage: Bun-Build → Bun-Runtime (ein Prozess)
```

## Lokale Entwicklung

Voraussetzungen: [Bun](https://bun.sh) ≥ 1.3.

```bash
bun install

# Dev-Server starten (Port 4321) — EmDash API + Astro SSR in einem Prozess
bun run dev
```

Die SQLite-Datenbank wird automatisch unter `./data/emdash.db` angelegt
(inklusive Schema-Migrations). Kein separater Backend-Prozess nötig.

### Build & lokal ausführen

```bash
bun run build        # → dist/   (NICHT `bun --bun run build`, das bricht Rollup)

# Den gebauten Server in der Bun-Runtime starten (wie in Produktion).
# Liefert statische + SSR-Seiten + API — alles ein Prozess.
PORT=3000 bun run start
```

## Deployment mit Coolify

1. Neue Ressource → **Dockerfile**-basiert, dieses Repo.
2. **Persistent Volume** mounten auf `/app/data` (SQLite-Datenbank).
3. Port **4321** exposen. Coolify terminiert TLS und leitet per HTTP weiter.
4. Environment-Variablen setzen (siehe `.env.example`):

| Variable                                                   | Zweck                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `DATABASE_PATH`                                            | Pfad zur SQLite-DB (Default `/app/data/emdash.db`)                  |
| `APP_URL`                                                  | öffentliche URL (E-Mail-Links, iCal, Unsubscribe)                   |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`                      | Absender transaktionaler Mails                                      |
| `MAIL_ADMIN_ADDRESS`, `MAIL_ADMIN_NAME`                    | Empfänger der Admin-Benachrichtigungen                              |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` | SMTP-Versand (ohne SMTP_HOST werden Mails nur geloggt)              |
| `PUBLIC_SITE_URL`                                          | **Build-Arg**: Canonical/Sitemap (Default `https://mens-circle.de`) |
| `PUBLIC_UMAMI_ID`, `PUBLIC_UMAMI_ENDPOINT`                 | optional: Umami-Analytics                                           |

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

Automatisch (EmDash API-Routen): Anmeldebestätigung, Wartelisten-Bestätigung,
Admin-Benachrichtigung, Wartelisten-Nachrückung, Newsletter-Willkommen.
Geplant (Cron, alle 15 min): Event-Erinnerung (heute/morgen).

Die E-Mail-Templates sind direkt in `server/lib.ts` als HTML-Strings definiert.
SMTP-Versand wird über `server/mailer.ts` abgewickelt (konfigurierbar via
`SMTP_HOST` etc.).
