#!/bin/sh
set -e

# Single process: the Astro server in the Bun runtime is the public edge and
# also runs the backend (API, SQLite, email, reminder cron) in-process. The
# database schema is created idempotently on first boot (see src/server/db),
# so there is no separate migration step.
: "${DATA_DIR:=/data}"
mkdir -p "$DATA_DIR"

echo "→ Starting Männerkreis server on 0.0.0.0:8090 (data: $DATA_DIR)"
# --smol keeps the Bun heap small (lower RAM) — fine for this traffic level.
HOST=0.0.0.0 PORT=8090 exec bun --smol run /app/dist/server/entry.mjs
