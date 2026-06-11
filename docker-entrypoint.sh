#!/bin/sh
set -e

PB_DATA_DIR="/pb/pb_data"
# PocketBase listens on loopback only; Caddy is the public edge (see Caddyfile).
PB_ADDR="127.0.0.1:8091"

# Optionally create/update the first superuser from environment variables so a
# fresh deploy is usable without the interactive install screen.
if [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASSWORD" ]; then
  echo "→ Ensuring superuser $PB_ADMIN_EMAIL exists"
  pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" \
    --dir "$PB_DATA_DIR" \
    --migrationsDir /pb/pb_migrations || echo "  (superuser upsert skipped/failed — continuing)"
fi

# Start PocketBase in the background. No --publicDir: the static site is served
# by Caddy now; PocketBase only handles the API, admin UI and pb_hooks routes.
echo "→ Starting PocketBase on $PB_ADDR"
pocketbase serve \
  --http "$PB_ADDR" \
  --dir "$PB_DATA_DIR" \
  --hooksDir /pb/pb_hooks \
  --migrationsDir /pb/pb_migrations &
PB_PID=$!

# If PocketBase exits, bring the whole container down so the orchestrator
# (Coolify) restarts it — a half-up container would only serve static files.
( while kill -0 "$PB_PID" 2>/dev/null; do sleep 5; done
  echo "✗ PocketBase exited — stopping container"
  kill 1 2>/dev/null ) &

# Caddy in the foreground (becomes PID 1 via exec). When it exits, the
# container exits and PocketBase is torn down with it.
echo "→ Starting Caddy on :8090"
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
