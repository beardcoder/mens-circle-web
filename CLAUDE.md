# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Website for the Männerkreis Niederbayern/Straubing. **Astro 7 + Svelte 5, SSR on the Bun runtime, Drizzle ORM on `bun:sqlite`, email via listmonk.** Bun is the package manager, build tool, **and** runtime. The README (German) is the authoritative deep-dive; this file is the operational summary.

## Commands

```bash
bun install                      # deps (uses bun.lock)

bun --bun run dev                # dev server — MUST use --bun, or DB pages crash on bun:sqlite
bun run build                    # production build — MUST NOT use --bun (breaks Rollup)
PORT=3000 DATABASE_PATH=./data/mens-circle.db \
  ADMIN_EMAIL=a@b.c ADMIN_PASSWORD=x bun run start   # run the built server like prod

bun run check                    # astro check (type-check .astro/.ts)
bun run lint                     # eslint .   (lint:fix to autofix)
bun run format                   # prettier --write  (format:check to verify)

bun run db:generate              # generate drizzle/<n>_*.sql after editing schema.ts
bun run db:studio                # Drizzle Studio DB browser
```

The `--bun` flag distinction is the most common footgun: **dev needs it, build forbids it.**

There is no test suite. Verify changes with `bun run check` + `bun run lint` and by exercising the app.

## Architecture

A **single Bun process** is the public edge **and** the backend — no nginx, no separate backend service. It serves hashed static assets + prerendered HTML from disk, renders SSR routes on demand, and handles API/admin/action routes as Astro endpoints. Built into one Docker image (`Dockerfile`), deployed via Coolify with a `/data` volume and port 8090. Server logic lives in `adapter/server.mjs`.

**Rendering:** Most pages are prerendered (static, RAM-friendly). Only **event pages and the home-page testimonials** render on demand (SSR) from the DB — content edits in the admin UI are live immediately, no rebuild.

**Data layer — `src/lib/server/db/`:** Drizzle on `bun:sqlite`. Schema in `schema.ts`; migrations in `drizzle/` are **applied automatically on boot** (`index.ts`). `bun:sqlite` is a Bun builtin kept `external` in `astro.config.mjs` (Rollup must not bundle it). After changing the schema, run `bun run db:generate`.

**`src/lib/server/*` is server-only** (db, events, registrations, testimonials, listmonk, email, auth, cron, ics, format, ratelimit, config). Never import it into client/Svelte code — it pulls in `bun:sqlite`. This is the business-logic layer; the two RPC surfaces below are thin wrappers over it.

**Two RPC surfaces:**

- **Public forms → `src/pages/api/*`** (register, newsletter, testimonial). Svelte islands POST JSON via `src/lib/api.ts`; endpoints validate, run capacity/waitlist logic, send mail, and return `{ success, message }`.
- **Admin back-office → Astro Actions in `src/actions/index.ts`** (served at `/_actions/*`). Admin components call `actions.<name>(input)` for typed `{ data, error }`. This replaced the old `/api/admin/*` endpoints + `admin-client.ts` (now empty/legacy).

**Auth & guards:** `src/middleware.ts` guards admin **pages** (`/admin/*`) behind a signed session cookie (`ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_SESSION_SECRET`); unauth pages redirect to login, API hits get 401. Actions live outside the `/admin` path match, so each mutating action **self-guards** via `requireAdmin`.

**Cron:** The reminder cron is started lazily from middleware, gated on the `__MC_RUNTIME` flag (set in `adapter/server.mjs`) so the build-time prerender never imports the `bun:sqlite` data layer.

**Email — listmonk (external service):** The app does not render emails. It calls listmonk's transactional API (`POST /api/tx`) with a template ID + data; templates are maintained in listmonk. Source templates + setup in `listmonk/tx-templates/`. Newsletter (double-opt-in + campaigns) also via listmonk. Template IDs are wired through `LISTMONK_TX_*` env vars.

## Content & conventions

- **Static content is JSON in the repo:** `src/content/home.json` (home block order + copy), `src/content/legal/*.json`, `src/data/site.json` (name, social, footer), `src/data/navigation.json`.
- **Dynamic content (events, registrations, testimonials)** is managed in the admin UI at `/admin`; newsletter in the listmonk admin.
- **Path aliases:** `@lib/*`, `@components/*`, `@data/*` (see `tsconfig.json`, extends `astro/tsconfigs/strict`).
- **Styling:** hand-organized CSS under `src/styles/` (base/components/sections/utilities, entry `app.css`). LightningCSS transforms/minifies; design tokens use native `oklch()`/`color-mix()` and are kept modern (not downleveled). CSS is inlined into each page's `<head>`.
- Fonts are self-hosted via the native Astro Fonts API (configured in `astro.config.mjs`, wired in `src/layouts/Layout.astro`).

## Environment

Copy `.env.example`. Without `ADMIN_*` the `/admin` area is unusable; without `LISTMONK_*` email/newsletter is inert. `PUBLIC_SITE_URL` is build-time (sitemap/OG); `APP_URL` is runtime (email links, .ics, image URLs); `DATABASE_PATH` defaults to `./data/mens-circle.db` locally and the `/data` volume in Docker.
