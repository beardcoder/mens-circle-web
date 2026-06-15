# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Männerkreis — single-image deploy for Coolify.
#
# A minimal, sustainable footprint built around a single Bun process:
#
#   Bun (:4321 — the exposed port, the public edge)
#   ├─ serves the build's static assets straight off disk (immutable caching)
#   ├─ /api · /newsletter  → EmDash API routes (bun:sqlite)
#   └─ everything else     → Astro SSR (on-demand rendering)
#
# The entire application runs in a single Bun process using bun:sqlite as the
# embedded database. No nginx, no PocketBase — just Bun.
# ─────────────────────────────────────────────────────────────────────────────

# 1) Install dependencies + build the Astro server bundle with Bun.
#    NB: the build path is baked into the bundle (the adapter records the
#    absolute client dir), so the runtime stage MUST use the same WORKDIR.
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# Canonical URL for sitemap / OG tags (build-time). Events + testimonials are
# rendered on demand from the embedded SQLite database, so there is no external
# data fetch at build time.
ARG PUBLIC_SITE_URL
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL
# Plain `bun run build` (NOT `bun --bun run`): forcing the Bun runtime breaks
# Astro's Rollup build, while `bun run` still uses Bun for everything else.
RUN bun run build

# 2) Final runtime image — single Bun process, no nginx, no PocketBase.
FROM oven/bun:1
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata wget \
    && rm -rf /var/lib/apt/lists/*
ENV TZ=Europe/Berlin
# Same WORKDIR as the build stage so the adapter's baked client path resolves.
WORKDIR /app

# The Astro server bundle + its runtime dependencies + the static client.
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# The server-side EmDash code (API, DB, cron, mailer).
COPY --from=build /app/server ./server

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Persisted data (SQLite database) — mount a Coolify volume here.
VOLUME ["/app/data"]
# Single Bun process is the public edge.
EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4321/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
