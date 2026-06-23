# Männerkreis Niederbayern / Straubing

Schnelle, leichtgewichtige Website für den Männerkreis — **Astro 7 + Svelte 5**,
**SSR in der Bun-Runtime**, **Drizzle ORM auf `bun:sqlite`** als Backend. Der
Bun-Server ist selbst der öffentliche Edge (kein nginx) **und** das Backend in
einem Prozess. Alles zusammen in **einem** Docker-Image, deploybar mit Coolify.
Paketmanager, Build-Tool **und** Laufzeit ist **Bun**.

## Architektur

```
┌─────────────────────────── ein Docker-Container ───────────────────────────┐
│                                                                             │
│   Astro-Server (Bun, Edge + Backend, :8090 — der nach außen exposte Port)   │
│   ├─ liefert statische Assets + vorgerenderte HTML direkt → /app/dist/client│
│   │    (gehashte Assets immutable, Security-Header)                         │
│   ├─ On-Demand-SSR: Startseite (Testimonials) + Event-Seiten                │
│   ├─ Public API  → /api/* (Anmeldung, Newsletter, Testimonial, Events, ICS) │
│   ├─ Admin-UI    → /admin/* (Events anlegen, Anmeldungen verwalten)         │
│   ├─ Datenhaltung → Drizzle ORM auf bun:sqlite (Datei im /data-Volume)      │
│   │    Migrationen werden beim Boot automatisch angewendet (drizzle/)       │
│   └─ Cron        → Event-Erinnerungen (alle 15 min, Bun.cron)               │
│                                           │                                 │
│                                           ▼ (E-Mail)                         │
│                                        listmonk (externer Dienst)           │
│                                        ├─ Newsletter + Kampagnen            │
│                                        ├─ Pro-Event-Listen                  │
│                                        └─ Transactional API (/api/tx)       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Bun-Server als Edge + Backend.** Ein einziger Bun-Prozess ist der
  öffentliche Einstieg: er liefert die gehashten Assets **und die vorgerenderten
  HTML-Seiten** direkt von Platte, rendert die SSR-Routen on demand und bedient
  die API- und Admin-Routen direkt als Astro-Endpunkte. Es gibt **keinen
  separaten Backend-Prozess** mehr — die Daten liegen in einer SQLite-Datei, auf
  die Drizzle in-process zugreift. Logik des Servers im Adapter
  ([`adapter/server.mjs`](adapter/server.mjs)). Kompression + TLS übernimmt der
  Coolify-Edge.
- **Datenhaltung: Drizzle + bun:sqlite.** Schema in
  [`src/lib/server/db/schema.ts`](src/lib/server/db/schema.ts), Migrationen unter
  [`drizzle/`](drizzle/) (mit `bun run db:generate` aus dem Schema erzeugt) werden
  beim Server-Boot automatisch angewendet
  ([`src/lib/server/db/index.ts`](src/lib/server/db/index.ts)).
- **Native Admin-UI.** Unter `/admin` (Login per `ADMIN_EMAIL`/`ADMIN_PASSWORD`,
  signiertes Session-Cookie) lassen sich Veranstaltungen anlegen/bearbeiten,
  Anmeldungen verwalten (Status ändern, stornieren → automatisches Nachrücken
  von der Warteliste) und Teilnehmer:innen anschreiben. Svelte-5-Islands,
  abgesichert per Middleware ([`src/middleware.ts`](src/middleware.ts)).
- **E-Mail über listmonk.** Sowohl der Newsletter (Double-Opt-In, Kampagnen) als
  auch die **transaktionalen** Event-Mails laufen über listmonk. Die App rendert
  die Mails nicht selbst, sondern ruft listmonks **Transactional API**
  (`POST /api/tx`) mit einer Template-ID + Daten auf; die Templates werden in
  listmonk gepflegt (Quelldateien + Anleitung in
  [`listmonk/tx-templates/`](listmonk/tx-templates/)).
- **RAM-schonend & nachhaltig.** Die meisten Seiten sind vorgerendert (statisch);
  nur Event-Seiten und die Testimonials der Startseite rendern serverseitig live.
  Ein Rebuild bei Content-Änderung entfällt — neue Events/Testimonials sind
  sofort sichtbar.
- **Statischer Content** (Texte, FAQ, Hero, Moderator …) liegt als **JSON** im
  Repo (`src/content/`, `src/data/`).
- **Dynamische Teile** (Anmeldung, Warteliste, Newsletter, Testimonial,
  Atemübung) sind **Svelte-5-Islands**, die per `fetch` mit der API sprechen.

## Projektstruktur

```
src/
  content/        home.json (Block-Reihenfolge + Texte), legal/*.json
  data/           site.json, navigation.json
  components/      Astro-Blöcke (Hero, Intro, FAQ …), Header, Footer, SEO
  components/islands/  Svelte-5-Islands (Formulare, Breathing, Event, Map …)
  components/admin/    Svelte-5-Islands der Admin-UI (Events, Anmeldungen, Stimmen)
  layouts/        Layout.astro (Seite), AdminLayout.astro (Back-Office)
  lib/            api.ts (Client), admin-client.ts, types, Utils
  lib/server/     Datenschicht (db/, events, registrations, testimonials,
                  listmonk, email, auth, reminders, ics, format) — NUR serverseitig
  middleware.ts   Admin-Guard (Reminder-Cron: Bun.cron via --preload, s. unten)
  pages/          index, event, atemuebung, teile-deine-erfahrung, [slug]
  pages/api/      Public-API + /api/admin/* (Astro-Endpunkte)
  pages/admin/    Admin-UI-Seiten
  styles/         vollständiges CSS-Designsystem (OKLCH, @layer, kein Tailwind)
drizzle/          generierte SQL-Migrationen (beim Boot angewendet)
drizzle.config.ts drizzle-kit-Konfiguration
listmonk/         listmonk-Templates (System, Kampagne) + tx-templates/ (Transactional)
adapter/          lokaler Astro-Bun-Adapter (Server-Entrypoint: Edge + SSR + API)
Dockerfile        Multi-Stage: Bun-Build → Bun-Runtime (ein Prozess)
```

## Lokale Entwicklung

Voraussetzungen: [Bun](https://bun.sh) ≥ 1.3.

```bash
bun install
cp .env.example .env   # ADMIN_EMAIL / ADMIN_PASSWORD setzen für /admin

bun run dev            # Astro-Dev-Server (Port 4321), API + Admin inklusive
```

Die SQLite-Datei wird automatisch unter `./data/mens-circle.db` angelegt und beim
Start migriert. Nach Schema-Änderungen neue Migration erzeugen:

```bash
bun run db:generate    # erzeugt drizzle/<n>_*.sql aus dem Schema
bun run db:studio      # optional: Drizzle Studio (DB-Browser)
```

### Build & lokal ausführen

```bash
bun run build          # → dist/   (NICHT `bun --bun run build`, das bricht Rollup)

# Den gebauten Server in der Bun-Runtime starten (wie in Produktion):
PORT=3000 DATABASE_PATH=./data/mens-circle.db \
  ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret \
  bun run start
```

## Deployment mit Coolify

1. Neue Ressource → **Dockerfile**-basiert, dieses Repo.
2. **Persistent Volume** mounten auf `/data` (die SQLite-Datenbank).
3. Port **8090** exposen (Bun-Server/Edge). Coolify terminiert TLS.
4. Environment-Variablen setzen (siehe `.env.example`):

| Variable                                                  | Zweck                                              |
| --------------------------------------------------------- | -------------------------------------------------- |
| `APP_URL`                                                 | öffentliche URL (E-Mail-Links, iCal, Bild-URLs)    |
| `DATABASE_PATH`                                           | SQLite-Datei (Default `/data/mens-circle.db`)      |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`                     | Absender transaktionaler Mails                     |
| `MAIL_ADMIN_ADDRESS`, `MAIL_ADMIN_NAME`                   | Empfänger der Admin-Benachrichtigungen             |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`                           | Login der Admin-UI (`/admin`)                      |
| `ADMIN_SESSION_SECRET`                                    | langer Zufallswert, signiert das Session-Cookie    |
| `LISTMONK_URL`, `LISTMONK_API_USER`, `LISTMONK_API_TOKEN` | listmonk-Admin-API                                 |
| `LISTMONK_LIST_IDS`                                       | numerische Newsletter-Listen-ID(s), z. B. `1`      |
| `LISTMONK_TX_*`                                           | IDs der transaktionalen listmonk-Templates (s. u.) |
| `PUBLIC_SITE_URL`                                         | **Build-Arg**: Canonical/Sitemap                   |
| `PUBLIC_UMAMI_ID`, `PUBLIC_UMAMI_ENDPOINT`                | optional: Umami-Analytics                          |

Die `LISTMONK_TX_*`-IDs verweisen auf die transaktionalen Templates, die einmalig
in listmonk angelegt werden — Anleitung + Quelldateien in
[`listmonk/tx-templates/`](listmonk/tx-templates/README.md).

## Content pflegen

- **Startseiten-Texte / Block-Reihenfolge:** `src/content/home.json`
- **Globale Einstellungen** (Name, Social-Links, WhatsApp-Link, Footer): `src/data/site.json`
- **Navigation:** `src/data/navigation.json`
- **Impressum / Datenschutz:** `src/content/legal/*.json`
- **Events, Anmeldungen, Stimmen:** in der **Admin-UI** unter `/admin`.
- **Newsletter (Abonnenten + Kampagnen):** im listmonk-Admin der externen Instanz.

**Events und Testimonials** werden serverseitig (SSR) live aus der Datenbank
gerendert — eine Änderung in der Admin-UI ist **sofort** sichtbar, ohne Rebuild.

## E-Mails

Alle Event-Mails laufen über listmonks **Transactional API**:

| Email                   | Auslöser                           |
| ----------------------- | ---------------------------------- |
| Anmeldebestätigung      | Anmeldung (Status `registered`)    |
| Wartelisten-Bestätigung | Anmeldung bei vollem Event         |
| Admin-Benachrichtigung  | jede Anmeldung                     |
| Wartelisten-Nachrückung | Stornierung → nächste:r rückt nach |
| Event-Erinnerung        | Cron, Event heute/morgen           |
| Teilnehmer-Nachricht    | manueller Versand aus der Admin-UI |

Newsletter (Willkommen/Double-Opt-In + Kampagnen) ebenfalls über listmonk.
Setup der transaktionalen Templates: [`listmonk/tx-templates/README.md`](listmonk/tx-templates/README.md).
