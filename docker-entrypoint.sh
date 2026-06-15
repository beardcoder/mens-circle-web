#!/bin/sh
set -e

# EmDash — single-process entrypoint.
# The Bun server handles everything: static files, SSR, API (bun:sqlite), cron.

# Ensure the data directory exists for the SQLite database.
mkdir -p /app/data

# Export database path for the application.
export DATABASE_PATH="${DATABASE_PATH:-/app/data/emdash.db}"

echo "→ Starting EmDash server on :4321"
exec bun --smol run /app/dist/server/entry.mjs
