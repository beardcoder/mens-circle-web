#!/bin/sh
set -e

# The Astro/Bun server is the single process: it serves static + on-demand SSR,
# the public API (/api/*) and the admin UI, all backed by the in-process Drizzle
# data layer (bun:sqlite). Migrations are applied automatically on boot (see
# src/lib/server/db/index.ts), so there is no separate provisioning step.

ASTRO_HOST="0.0.0.0"
ASTRO_PORT="8090"

# Persist the SQLite database in the mounted volume.
export DATABASE_PATH="${DATABASE_PATH:-/data/mens-circle.db}"

# Cap glibc's per-thread malloc arenas.
#
# Insurance, not a hot path: no page this server renders asks for an image any
# more (astro-integrations/hero-images.mjs resizes them during the build), so
# libvips never loads under normal traffic. But Astro always registers its
# /_image endpoint, and a hand-written request to it still pulls libvips in.
# libvips is threaded, and glibc hands every thread that allocates its own 64MB
# arena and keeps it — native memory, outside the Bun heap, where `--smol`
# cannot reach it. Measured on the built server, 15 such requests: 189MB with
# the default arenas, 159MB with two. Normal traffic sits at ~100MB either way.
export MALLOC_ARENA_MAX="${MALLOC_ARENA_MAX:-2}"

echo "→ Starting Astro server on $ASTRO_HOST:$ASTRO_PORT (db: $DATABASE_PATH)"
# --smol keeps the Bun heap small (lower RAM) — fine for this traffic level.
# --preload registers the event-reminder cron (Bun.cron) once at startup, in
# this same process, before the Astro entry boots. NB: --preload must precede
# the entry file and the `run` subcommand is dropped (`bun run --preload …`
# is rejected — preload is a runtime flag, not a run-script flag).
HOST="$ASTRO_HOST" PORT="$ASTRO_PORT" \
  exec bun --smol --preload /app/scripts/reminder-cron.ts /app/dist/server/entry.mjs
