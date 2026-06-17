#!/bin/sh
set -e

PB_DATA_DIR="/pb/pb_data"
# PocketBase listens on loopback only; the Astro/Bun server is the public edge
# and proxies the PocketBase paths to it (there is no nginx).
PB_ADDR="127.0.0.1:8091"
ASTRO_HOST="0.0.0.0"
ASTRO_PORT="8090"

# Optionally create/update the first superuser from environment variables so a
# fresh deploy is usable without the interactive install screen.
if [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASSWORD" ]; then
  echo "→ Ensuring superuser $PB_ADMIN_EMAIL exists"
  pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" \
    --dir "$PB_DATA_DIR" \
    --migrationsDir /pb/pb_migrations || echo "  (superuser upsert skipped/failed — continuing)"
fi

# 1) PocketBase (REST API, admin UI, email, cron) on loopback.
echo "→ Starting PocketBase on $PB_ADDR"
pocketbase serve \
  --http "$PB_ADDR" \
  --dir "$PB_DATA_DIR" \
  --hooksDir /pb/pb_hooks \
  --migrationsDir /pb/pb_migrations &
PB_PID=$!

# If PocketBase dies, bring the whole container down so the orchestrator
# (Coolify) restarts it — a half-up container would only serve errors. (The
# Astro server is PID 1 below, so its death already stops the container.)
( while kill -0 "$PB_PID" 2>/dev/null; do
    sleep 5
  done
  echo "✗ PocketBase exited — stopping container"
  kill 1 2>/dev/null ) &

# 2) Astro server (Bun runtime) in the foreground (→ becomes PID 1 via exec).
#    It is the public edge: serves prerendered files + on-demand SSR and proxies
#    the PocketBase paths (/api, /_) to PB_INTERNAL_URL. SSR also fetches
#    PocketBase via PB_INTERNAL_URL. --smol keeps the Bun heap small (lower RAM)
#    — fine for this traffic level. When it exits the container exits.
echo "→ Starting Astro server on $ASTRO_HOST:$ASTRO_PORT"
HOST="$ASTRO_HOST" PORT="$ASTRO_PORT" PB_INTERNAL_URL="http://${PB_ADDR}" \
  exec bun --smol run /app/dist/server/entry.mjs
