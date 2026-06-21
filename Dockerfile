# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Männerkreis — single-image deploy for Coolify.
#
# One process, a small sustainable footprint:
#
#   Astro server (Bun runtime, :8090 — the exposed port, the public edge)
#   ├─ serves the build's static assets + prerendered HTML (immutable caching)
#   ├─ on-demand SSR (event pages + home testimonials)
#   ├─ the public API (/api/*) and the admin UI (/admin/*)
#   └─ data layer: Drizzle on bun:sqlite (file in the mounted /data volume),
#      migrations applied automatically on boot
#
# Transactional + newsletter email is delegated to listmonk (see docker-compose).
# The frontend runs in the Bun runtime (NOT Node); the Bun server is the single
# public edge (no nginx, no separate backend process).
# ─────────────────────────────────────────────────────────────────────────────

# 1) Install dependencies + build the Astro server bundle with Bun.
#    NB: the build path is baked into the bundle (the adapter records the
#    absolute client dir), so the runtime stage MUST use the same WORKDIR.
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# Canonical URL for sitemap / OG tags (build-time).
ARG PUBLIC_SITE_URL
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL
# Bake the JSON log handler into the SSR manifest (see astro.config.mjs).
ENV LOG_FORMAT=json
# Plain `bun run build` (NOT `bun --bun run`): forcing the Bun runtime breaks
# Astro's Rollup build, while `bun run` still uses Bun for everything else.
RUN bun run build

# 2) Final runtime image — Bun runtime only.
FROM oven/bun:1
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tzdata wget \
  && rm -rf /var/lib/apt/lists/*
ENV TZ=Europe/Berlin
# Same WORKDIR as the build stage so the adapter's baked client path resolves.
WORKDIR /app

# The Astro server bundle + its runtime dependencies + the static client (the
# Bun server serves these). The build path is baked in, so /app must match.
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
# Drizzle migrations — applied at runtime on boot (resolved against the WORKDIR).
COPY --from=build /app/drizzle ./drizzle
# Operational scripts (e.g. the SQLite → S3 backup, run via a scheduled
# `docker exec <web> bun run scripts/backup-db.ts`).
COPY --from=build /app/scripts ./scripts

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Persisted data (the SQLite database) — mount a Coolify volume here.
ENV DATABASE_PATH=/data/mens-circle.db
VOLUME ["/data"]
# The Bun server is the public edge on :8090.
EXPOSE 8090

# Liveness probe for Coolify/Docker. /health is answered directly by the Bun
# edge (adapter/server.mjs), with no SSR render, via wget (curl is NOT in this
# image). A 200 means the public edge is accepting and serving requests.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8090/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
