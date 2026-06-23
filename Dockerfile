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
  && apt-get install -y --no-install-recommends ca-certificates tzdata wget xz-utils \
  && rm -rf /var/lib/apt/lists/*
ENV TZ=Europe/Berlin

# s6-overlay: PID 1 init that runs the Bun web server (as the container CMD) and
# supervises the reminder cron as a side service (see docker/s6-rc.d/). This
# replaces the old in-process setInterval cron that lived in the web process.
ARG TARGETARCH
ARG S6_OVERLAY_VERSION=3.2.1.0
RUN set -eux; \
  case "${TARGETARCH}" in \
    amd64) S6_ARCH=x86_64 ;; \
    arm64) S6_ARCH=aarch64 ;; \
    *) echo "unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
  esac; \
  base="https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}"; \
  wget -qO /tmp/s6-noarch.tar.xz "${base}/s6-overlay-noarch.tar.xz"; \
  wget -qO /tmp/s6-arch.tar.xz   "${base}/s6-overlay-${S6_ARCH}.tar.xz"; \
  tar -C / -Jxpf /tmp/s6-noarch.tar.xz; \
  tar -C / -Jxpf /tmp/s6-arch.tar.xz; \
  rm -f /tmp/s6-noarch.tar.xz /tmp/s6-arch.tar.xz
# If the web server (the CMD) exits, bring the whole container down so Coolify
# restarts it, instead of leaving the reminder service running headless.
ENV S6_BEHAVIOUR_IF_STAGE2_FAILS=2

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
# `docker exec <web> bun run scripts/backup-db.ts`; and scripts/send-reminders.ts,
# run by the s6 reminders service).
COPY --from=build /app/scripts ./scripts
# Source the reminder script imports at runtime (server-only, no astro: deps).
# This layer holds the business logic the cron pass reuses (db, email, listmonk…).
COPY --from=build /app/src/lib/server ./src/lib/server

# s6-overlay service definitions (the supervised reminder cron).
COPY docker/s6-rc.d /etc/s6-overlay/s6-rc.d
RUN chmod +x /etc/s6-overlay/s6-rc.d/reminders/run

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

# s6-overlay is PID 1; the Bun web server runs as the foreground CMD (its exit
# tears the container down — see S6_BEHAVIOUR_IF_STAGE2_FAILS), while the
# reminder cron runs as a supervised side service.
ENTRYPOINT ["/init"]
CMD ["docker-entrypoint.sh"]
