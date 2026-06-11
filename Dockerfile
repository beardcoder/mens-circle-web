# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Männerkreis — single-image deploy for Coolify.
#
# A tiny, sustainable footprint: the production image is Alpine + two static
# binaries — Ferron (Rust) and PocketBase (Go).
#
#   Ferron (edge, :8090) ─┬─ serves the pre-built static Astro site (/srv/site)
#                         │   with full Cache-Control / security-header control
#                         └─ reverse-proxies the dynamic paths to PocketBase
#   PocketBase (127.0.0.1:8091)  API, admin UI, email (pb_hooks), cron, DB
#
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

# 2b) Fetch the Ferron (statically-linked, musl) binary for the target arch.
FROM alpine:3.21 AS ferron
ARG FERRON_VERSION=2.7.0
ARG TARGETARCH
RUN apk add --no-cache ca-certificates unzip wget
RUN set -eux; \
    case "${TARGETARCH:-amd64}" in \
      amd64) FER_TARGET=x86_64-unknown-linux-musl ;; \
      arm64) FER_TARGET=aarch64-unknown-linux-musl ;; \
      *)     FER_TARGET=x86_64-unknown-linux-musl ;; \
    esac; \
    wget -q "https://dl.ferron.sh/${FERRON_VERSION}/ferron-${FERRON_VERSION}-${FER_TARGET}.zip" -O /tmp/ferron.zip; \
    unzip /tmp/ferron.zip -d /ferron; \
    rm /tmp/ferron.zip

# 3) Final runtime image.
FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata wget
ENV TZ=Europe/Berlin
WORKDIR /pb

COPY --from=ferron /ferron/ferron /usr/local/bin/ferron
COPY --from=pocketbase /pb/pocketbase /usr/local/bin/pocketbase
COPY pocketbase/pb_hooks ./pb_hooks
COPY pocketbase/pb_migrations ./pb_migrations
# Astro static site is served by Ferron (not PocketBase) for full header control.
COPY --from=build /app/dist /srv/site
COPY ferron.kdl /etc/ferron.kdl
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Persisted data (database, uploaded files) — mount a Coolify volume here.
VOLUME ["/pb/pb_data"]
# Ferron is the edge; PocketBase stays on loopback 8091 (not exposed).
EXPOSE 8090

# Hits Ferron, which proxies to PocketBase — validates the whole chain.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8090/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
