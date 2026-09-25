#!/bin/sh
set -e

ASTRO_HOST="0.0.0.0"
ASTRO_PORT="8090"

# Persist the SQLite database in the mounted volume.
export DATABASE_PATH="${DATABASE_PATH:-/data/mens-circle.db}"

echo "→ Starting Astro server on $ASTRO_HOST:$ASTRO_PORT (db: $DATABASE_PATH)"
HOST="$ASTRO_HOST" PORT="$ASTRO_PORT" exec bun /app/dist/server/entry.mjs
