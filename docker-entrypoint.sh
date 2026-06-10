#!/bin/sh
set -e

PB_DATA_DIR="/pb/pb_data"

# Optionally create/update the first superuser from environment variables so a
# fresh deploy is usable without the interactive install screen.
if [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASSWORD" ]; then
  echo "→ Ensuring superuser $PB_ADMIN_EMAIL exists"
  pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" \
    --dir "$PB_DATA_DIR" \
    --migrationsDir /pb/pb_migrations || echo "  (superuser upsert skipped/failed — continuing)"
fi

exec pocketbase serve \
  --http 0.0.0.0:8090 \
  --dir "$PB_DATA_DIR" \
  --hooksDir /pb/pb_hooks \
  --migrationsDir /pb/pb_migrations \
  --publicDir /pb/pb_public
