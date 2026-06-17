# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Männerkreis — single-image deploy for Coolify.
#
# A small, sustainable footprint built around two co-located processes:
#
#   Astro server (Bun runtime, :8090 — the exposed port, the public edge)
#   ├─ serves the build's static assets + prerendered HTML (immutable caching)
#   ├─ on-demand SSR (event pages + home testimonials, live from PocketBase)
#   └─ /api · /_  → proxied to PocketBase (127.0.0.1:8091)
#   PocketBase (127.0.0.1:8091)  REST API, admin UI, transactional email
#                                (pb_hooks), cron, DB — never exposed directly.
#
# The frontend runs in the Bun runtime (NOT Node). The Bun server is the single
# public edge (no nginx); PocketBase keeps the data + email + cron logic.
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
# NO LONGER fetched at build time — they render on demand from PocketBase, so
# there is no PB_URL build arg and no rebuild-on-content-change anymore.
ARG PUBLIC_SITE_URL
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL
# Plain `bun run build` (NOT `bun --bun run`): forcing the Bun runtime breaks
# Astro's Rollup build, while `bun run` still uses Bun for everything else.
RUN bun run build

# 2) Fetch the PocketBase binary for the target architecture.
FROM alpine:3.21 AS pocketbase
ARG PB_VERSION=0.39.3
ARG TARGETARCH
RUN apk add --no-cache ca-certificates unzip wget
RUN set -eux; \
  case "${TARGETARCH:-amd64}" in \
  amd64) PB_ARCH=amd64 ;; \
  arm64) PB_ARCH=arm64 ;; \
  *)     PB_ARCH=amd64 ;; \
  esac; \
  wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip" -O /tmp/pb.zip; \
  unzip /tmp/pb.zip -d /pb; \
  rm /tmp/pb.zip

# 3) Final runtime image — Bun runtime + the PocketBase binary.
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

# PocketBase: binary + hooks + migrations (data lives in the mounted volume).
COPY --from=pocketbase /pb/pocketbase /usr/local/bin/pocketbase
COPY pocketbase/pb_hooks /pb/pb_hooks
COPY pocketbase/pb_migrations /pb/pb_migrations
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Persisted data (database, uploaded files) — mount a Coolify volume here.
VOLUME ["/pb/pb_data"]
# The Bun server is the public edge on :8090; PocketBase (8091) stays loopback.
EXPOSE 8090

ENTRYPOINT ["docker-entrypoint.sh"]
