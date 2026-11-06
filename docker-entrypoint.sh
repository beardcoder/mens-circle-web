#!/bin/sh
set -e

export DATABASE_PATH="${DATABASE_PATH:-/data/mens-circle.db}"
data_dir="$(dirname "$DATABASE_PATH")"

# The image runs as bun (uid 1000). A volume first written by an older image (root)
# must be handed over once; fail with the fix instead of a SQLite error.
if [ -d "$data_dir" ] && ! [ -w "$data_dir" ]; then
  echo "✗ $data_dir is not writable for $(id -un) (uid $(id -u))." >&2
  echo "  Hand the volume over once, e.g.: docker run --rm -v <volume>:/data alpine chown -R 1000:1000 /data" >&2
  exit 1
fi

echo "→ Starting server on 0.0.0.0:8090 (db: $DATABASE_PATH)"
HOST=0.0.0.0 PORT=8090 exec bun /app/server.ts
