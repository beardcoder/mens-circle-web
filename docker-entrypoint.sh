#!/bin/sh
set -e

PB_DATA_DIR="/pb/pb_data"
# PocketBase listens on loopback only; the Bun edge is the public face.
PB_ADDR="127.0.0.1:8091"

# Optionally create/update the first superuser from environment variables so a
# fresh deploy is usable without the interactive install screen.
if [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASSWORD" ]; then
  echo "→ Ensuring superuser $PB_ADMIN_EMAIL exists"
  pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" \
    --dir "$PB_DATA_DIR" \
    --migrationsDir /pb/pb_migrations || echo "  (superuser upsert skipped/failed — continuing)"
fi

# Start PocketBase in the background on loopback. The Bun edge serves the site
# and reverse-proxies the API/admin/unsubscribe paths to it.
echo "→ Starting PocketBase on $PB_ADDR"
pocketbase serve \
  --http "$PB_ADDR" \
  --dir "$PB_DATA_DIR" \
  --hooksDir /pb/pb_hooks \
  --migrationsDir /pb/pb_migrations &
PB_PID=$!

# If PocketBase exits, bring the whole container down so the orchestrator
# (Coolify) restarts it — a half-up container would only serve cached pages.
( while kill -0 "$PB_PID" 2>/dev/null; do sleep 5; done
  echo "✗ PocketBase exited — stopping container"
  kill 1 2>/dev/null ) &

# The Bun edge in the foreground (becomes PID 1 via exec). It SSR-fetches from
# PocketBase on loopback and proxies the dynamic paths there. When it exits the
# container exits and PocketBase is torn down with it.
echo "→ Starting Bun edge on :8090"
export HOST="0.0.0.0"
export PORT="8090"
export PB_INTERNAL_URL="http://${PB_ADDR}"
exec bun run /app/dist/server/entry.mjs
