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

echo "→ Starting Astro server on $ASTRO_HOST:$ASTRO_PORT (db: $DATABASE_PATH)"
# --smol keeps the Bun heap small (lower RAM) — fine for this traffic level.
HOST="$ASTRO_HOST" PORT="$ASTRO_PORT" \
  exec bun --smol run /app/dist/server/entry.mjs
