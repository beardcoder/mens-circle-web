#!/bin/sh
set -e

export DATABASE_PATH="${DATABASE_PATH:-/data/mens-circle.db}"

echo "→ Starting server on 0.0.0.0:8090 (db: $DATABASE_PATH)"
HOST=0.0.0.0 PORT=8090 exec bun /app/dist/server/entry.mjs
