# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Männerkreis — single-image deploy for Coolify.
#
# A tiny, sustainable footprint: the production image is just Alpine + the
# PocketBase Go binary, which serves the pre-built static Astro site (pb_public)
# AND provides the API, admin UI, transactional email (pb_hooks) and cron.
# There is NO Node/Bun runtime in production — Bun is only the build tool.
# ─────────────────────────────────────────────────────────────────────────────

# 1) Build the static frontend with Bun.
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# Build-time data source: events + testimonials are fetched from the LIVE
# PocketBase and baked into the static HTML. Point PB_URL at the running
# instance (e.g. https://mens-circle.de) via a Coolify build arg. If it is unset
# or unreachable (e.g. the very first deploy), the fetchers return empty and the
# pages render their graceful "no content" state — the next content change
# triggers a rebuild that picks the data up.
ARG PB_URL
ARG PUBLIC_SITE_URL
ENV PB_URL=$PB_URL
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

# 3) Final runtime image.
FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata wget
ENV TZ=Europe/Berlin
WORKDIR /pb

COPY --from=pocketbase /pb/pocketbase /usr/local/bin/pocketbase
COPY pocketbase/pb_hooks ./pb_hooks
COPY pocketbase/pb_migrations ./pb_migrations
COPY --from=build /app/dist ./pb_public
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Persisted data (database, uploaded files) — mount a Coolify volume here.
VOLUME ["/pb/pb_data"]
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8090/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
