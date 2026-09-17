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
# Astro's /_image endpoint optimises the SSR home page's photo per request, and
# it runs on libvips (sharp's native core). libvips is threaded, and glibc hands
# every thread that allocates its own 64MB arena and keeps it. That memory is
# native, outside the Bun heap, so `--smol` never touches it. Measured on the
# built server, cold, over the 15 variants the home page's photo has: 178MB with
# the default arenas, 160MB with two. Two is the usual floor that still lets the
# pool threads work.
export MALLOC_ARENA_MAX="${MALLOC_ARENA_MAX:-2}"

echo "→ Starting Astro server on $ASTRO_HOST:$ASTRO_PORT (db: $DATABASE_PATH)"
# --smol keeps the Bun heap small (lower RAM) — fine for this traffic level.
# --preload registers the event-reminder cron (Bun.cron) once at startup, in
# this same process, before the Astro entry boots. NB: --preload must precede
# the entry file and the `run` subcommand is dropped (`bun run --preload …`
# is rejected — preload is a runtime flag, not a run-script flag).
HOST="$ASTRO_HOST" PORT="$ASTRO_PORT" \
  exec bun --smol --preload /app/scripts/reminder-cron.ts /app/dist/server/entry.mjs
