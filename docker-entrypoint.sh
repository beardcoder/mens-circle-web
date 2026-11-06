#!/bin/sh
set -e

export DATABASE_PATH="${DATABASE_PATH:-/data/mens-circle.db}"
data_dir="$(dirname "$DATABASE_PATH")"

# The container starts as root only to hand the data volume to `bun` (uid 1000): a
# volume first written by an older image belongs to root. Then the server runs as
# bun, never as root.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$data_dir"
  if [ "$(stat -c %u "$data_dir")" != "1000" ] || find "$data_dir" ! -user 1000 -print -quit | grep -q .; then
    echo "→ Handing $data_dir to bun (uid 1000)"
    chown -R bun:bun "$data_dir"
  fi
  echo "→ Starting server on 0.0.0.0:8090 as bun (db: $DATABASE_PATH)"
  HOST=0.0.0.0 PORT=8090 exec setpriv --reuid=bun --regid=bun --init-groups bun /app/server.ts
fi

if ! [ -w "$data_dir" ]; then
  echo "✗ $data_dir is not writable for $(id -un) (uid $(id -u))." >&2
  exit 1
fi

echo "→ Starting server on 0.0.0.0:8090 (db: $DATABASE_PATH)"
HOST=0.0.0.0 PORT=8090 exec bun /app/server.ts
