#!/bin/sh
set -e

PB_DATA_DIR="/pb/pb_data"
# Both app processes listen on loopback only; nginx is the public edge.
PB_ADDR="127.0.0.1:8091"
ASTRO_HOST="127.0.0.1"
ASTRO_PORT="4321"

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

# 2) Astro server (Bun runtime) on loopback. SSR pages fetch PocketBase via
#    PB_INTERNAL_URL; the browser never talks to it directly (nginx fronts it).
#    --smol keeps the Bun heap small (lower RAM) — fine for this traffic level.
echo "→ Starting Astro server on $ASTRO_HOST:$ASTRO_PORT"
HOST="$ASTRO_HOST" PORT="$ASTRO_PORT" PB_INTERNAL_URL="http://${PB_ADDR}" \
  bun --smol run /app/dist/server/entry.mjs &
ASTRO_PID=$!

# If either backend dies, bring the whole container down so the orchestrator
# (Coolify) restarts it — a half-up container would only serve errors.
( while kill -0 "$PB_PID" 2>/dev/null && kill -0 "$ASTRO_PID" 2>/dev/null; do
    sleep 5
  done
  echo "✗ A backend process exited — stopping container"
  kill 1 2>/dev/null ) &

# 3) nginx in the foreground (daemon off; → becomes PID 1 via exec). It routes
#    /api·/_·/newsletter to PocketBase and everything else to Astro, and serves
#    the static assets directly. When it exits the container exits.
echo "→ Starting nginx on :8090"
exec nginx -c /etc/nginx/nginx.conf
