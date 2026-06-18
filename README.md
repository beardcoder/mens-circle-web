# Männerkreis Niederbayern / Straubing

Schnelle, leichtgewichtige Website für den Männerkreis — **Astro 6 + Svelte 5**,
**SSR in der Bun-Runtime**. Das Backend (Datenhaltung, API, transaktionale
E-Mails, Cron, Admin) läuft **in-process** im selben Bun-Server: **Bun + SQLite**
über [Drizzle](https://orm.drizzle.team). Kein zweiter Prozess, kein nginx —
alles in **einem** Docker-Image, deploybar mit Coolify (oder jedem Container-Host).
Paketmanager, Build-Tool **und** Laufzeit ist **Bun**.

> Früher lag das Backend in einem separaten PocketBase-Prozess. Es wurde durch
> eine schlanke, in Astro integrierte Bun-/SQLite-Schicht ersetzt (`src/server/`).
> Das alte `pocketbase/`-Verzeichnis bleibt nur noch als Referenz liegen und wird
> weder gebaut noch ausgeliefert.

## Architektur

```
┌──────────────────────── ein Bun-Prozess (Docker) ────────────────────────┐
│                                                                           │
│  Astro-Server (Bun, Edge, :8090 — der nach außen exposte Port)            │
│  ├─ liefert statische Assets + vorgerenderte HTML direkt  → dist/client   │
│  ├─ On-Demand-SSR: Startseite (Testimonials), Event-Seiten, /admin        │
│  ├─ /api/*   → Astro-Endpoints (Anmeldung, Testimonial, Newsletter,       │
│  │             öffentliche Events, .ics, Datei-Auslieferung, Cron)        │
│  └─ /admin/* → schlankes, eingebautes Admin (Events, Anmeldungen,         │
│                Testimonials), geschützt per Session-Cookie                │
│                                                                           │
│  Backend in-process (src/server/):                                        │
│  ├─ Domäne   → Services (Anmeldung/Warteliste, Events, Testimonials,      │
│  │             Reminder) + Domänen-Events für den E-Mail-Versand          │
│  ├─ DB       → Drizzle + bun:sqlite  (eine Datei in /data)                │
│  ├─ Mail     → SMTP via nodemailer + HTML-Templates + iCal                │
│  └─ Cron     → Event-Erinnerung (Intervall + interner Endpoint)           │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Ein Bun-Prozess als Edge & Backend.** Der Bun-Server liefert gehashte Assets
  und vorgerenderte HTML direkt von Platte (Cache-Control je Asset-Klasse +
  Security-Header), rendert die SSR-Routen on demand und bedient die `/api/*`-
  Endpoints und das `/admin`. Logik im Adapter ([`adapter/server.mjs`](adapter/server.mjs)).
  Kompression + TLS übernimmt der Coolify-Edge.
- **Host-agnostisch entworfen.** Die Domäne kennt nur Ports (`MailPort`,
  `NewsletterPort`) und spricht die DB über Drizzle an. Der Wechsel auf einen
  anderen Host ist damit lokal: SQLite → D1/Postgres ist ein Tausch in
  [`src/server/db/index.ts`](src/server/db/index.ts), SMTP → Resend/MailChannels
  einer in [`src/server/container.ts`](src/server/container.ts). Der Reminder-Cron
  ist ein HTTP-Endpoint, den auch ein externer Scheduler (z. B. ein Cloudflare
  Cron Trigger) treiben kann.
- **RAM-schonend.** Die meisten Seiten sind vorgerendert; nur Event-Seiten, die
  Startseiten-Testimonials und `/admin` rendern serverseitig. SQLite-Abfragen
  laufen in-process (kein Netzwerk-Hop). `bun --smol` hält den Heap klein.
- **Statischer Content** (Texte, FAQ, Hero, Moderator …) liegt als **JSON** im
  Repo (`src/content/`, `src/data/`).
- **Dynamische Teile** (Anmeldung, Warteliste, Newsletter, Testimonial,
  Atemübung) sind **Svelte-5-Islands**, die per `fetch` mit den `/api`-Endpoints
  sprechen.
- **Newsletter über listmonk.** Abonnenten und Kampagnen liegen in einer
  externen [listmonk](https://listmonk.app)-Instanz. Das Anmeldeformular postet
  an `/api/newsletter/subscribe`; der Endpoint leitet an die listmonk-Admin-API
  weiter. Double-Opt-In, Versand und Abmeldung übernimmt listmonk.

## Projektstruktur

```
src/
  content/        home.json (Block-Reihenfolge + Texte), legal/*.json
  data/           site.json, navigation.json
  components/     Astro-Blöcke (Hero, Intro, FAQ …), Header, Footer, SEO
  components/islands/  Svelte-5-Islands (Formulare, Breathing, Event, Map …)
  components/admin/    Admin-Formulare
  layouts/        Layout.astro (öffentlich), AdminLayout.astro (Admin)
  lib/            Client-/SSR-Helper, Utils (toast, motion, umami, calendar …)
  pages/          index, event, atemuebung, [slug]
  pages/api/      Endpoints (event, testimonial, newsletter, public, files, internal)
  pages/admin/    Login + Dashboard + Events + Testimonials
  middleware.ts   schützt /admin und /api/admin
  server/         das Backend, das PocketBase ersetzt hat:
    config.ts       env-Konfiguration
    db/             Drizzle-Schema + bun:sqlite-Client (Schema-Init beim Boot)
    domain/services Anmeldung/Warteliste, Events, Testimonials, Reminder
    notifications   Domänen-Events → E-Mail-Versand
    mail/           SMTP-Transport + HTML-Templates
    ics.ts          iCalendar-Builder
    infra/listmonk  Newsletter-/Event-Listen-Client
    auth.ts         Admin-Session (signiertes Cookie)
adapter/          lokaler Astro-6-Bun-Adapter (Edge + SSR + Reminder-Intervall)
Dockerfile        Bun-Build → Bun-Runtime (ein Prozess)
```

## Lokale Entwicklung

Voraussetzungen: [Bun](https://bun.sh) ≥ 1.3.

```bash
bun install

# .env anlegen (Admin-Login + optional SMTP/listmonk):
cp .env.example .env
#   ADMIN_EMAIL=du@example.com
#   ADMIN_PASSWORD=einPasswort
#   (SMTP leer lassen → Mails werden nur geloggt statt versendet)

# Optional: ein Beispiel-Event in eine frische DB seeden
bun run db:seed

# Dev-Server (Port 4321) — Frontend UND Backend in einem Prozess
bun run dev
```

Die Datenbank wird beim ersten Zugriff unter `./data/app.db` angelegt
(Schema idempotent beim Boot, keine separate Migration nötig). Das Admin
erreichst du unter `http://localhost:4321/admin`. Zum Stöbern in den Daten:
`bun run db:studio` (Drizzle Studio).

### Build & lokal ausführen

```bash
bun run build        # → dist/   (NICHT `bun --bun run build`, das bricht Rollup)

# Den gebauten Server in der Bun-Runtime starten (wie in Produktion):
PORT=3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… SESSION_SECRET=… CRON_SECRET=… \
  bun run start
```

## Deployment mit Coolify

1. Neue Ressource → **Dockerfile**-basiert, dieses Repo.
2. **Persistent Volume** mounten auf `/data` (SQLite-Datenbank + hochgeladene Bilder).
3. Port **8090** exposen (der Bun-Server/Edge). Coolify terminiert TLS.
4. Environment-Variablen setzen (siehe `.env.example`):

| Variable | Zweck |
| --- | --- |
| `APP_URL` | öffentliche URL (E-Mail-Links, iCal, Bild-URLs) |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | Absender transaktionaler Mails |
| `MAIL_ADMIN_ADDRESS`, `MAIL_ADMIN_NAME` | Empfänger der Admin-Benachrichtigungen |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_TLS` | SMTP-Versand |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Login für das Admin unter `/admin` |
| `SESSION_SECRET` | signiert das Admin-Session-Cookie (langer Zufallsstring) |
| `CRON_SECRET` | schützt den Reminder-Cron-Endpoint; nur wenn gesetzt läuft der Cron |
| `LISTMONK_URL`, `LISTMONK_API_USER`, `LISTMONK_API_TOKEN`, `LISTMONK_LIST_IDS` | Newsletter → listmonk |
| `PUBLIC_SITE_URL` | **Build-Arg**: Canonical/Sitemap (Default `https://mens-circle.de`) |
| `PUBLIC_UMAMI_ID`, `PUBLIC_UMAMI_ENDPOINT` | optional: Umami-Analytics |

`DATA_DIR` (Default `/data` im Container) steuert, wo DB und Uploads liegen.

## Content pflegen

- **Startseiten-Texte / Block-Reihenfolge:** `src/content/home.json`
- **Globale Einstellungen** (Name, Social-Links, WhatsApp-Link, Footer): `src/data/site.json`
- **Navigation:** `src/data/navigation.json`
- **Impressum / Datenschutz:** `src/content/legal/*.json`
- **Events, Anmeldungen, Testimonials:** im Admin unter `/admin`.
- **Newsletter (Abonnenten + Kampagnen):** im listmonk-Admin der externen Instanz.

Nach Content-Änderungen am **JSON**: neu deployen (Coolify-Rebuild). **Events und
Testimonials** rendern serverseitig (SSR) live aus der Datenbank — eine Änderung
im Admin ist **sofort** sichtbar, ohne Rebuild. Auch Anmeldungen/Kapazität sind
dadurch immer live.

## E-Mails

Automatisch (Domänen-Events): Anmeldebestätigung, Wartelisten-Bestätigung,
Admin-Benachrichtigung, Wartelisten-Nachrückung.
Geplant (Cron, alle 15 min): Event-Erinnerung (heute/morgen).
Newsletter (Willkommen/Double-Opt-In + Kampagnen): über listmonk.

Templates: [`src/server/mail/templates.ts`](src/server/mail/templates.ts).
Versand via SMTP ([`src/server/mail/transport.ts`](src/server/mail/transport.ts));
ist `SMTP_HOST` leer, werden Mails nur geloggt (nicht versendet).
