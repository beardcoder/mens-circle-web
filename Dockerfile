# syntax=docker/dockerfile:1

# Bun pinned to a minor version: a rebuild gets patches, never a new minor by surprise.
# Raise it on purpose (and in CI's setup-bun) together.
ARG BUN_IMAGE=oven/bun:1.4-slim

FROM ${BUN_IMAGE} AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
COPY . .
ARG PUBLIC_SITE_URL
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL
# Analytics loads only when both are given as build arguments (Coolify: build variables).
ARG PUBLIC_UMAMI_ID
ARG PUBLIC_UMAMI_ENDPOINT
ENV PUBLIC_UMAMI_ID=$PUBLIC_UMAMI_ID PUBLIC_UMAMI_ENDPOINT=$PUBLIC_UMAMI_ENDPOINT
RUN bun run build

FROM ${BUN_IMAGE} AS production-deps
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --production

FROM ${BUN_IMAGE}
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tzdata wget \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data \
  && chown bun:bun /data
ENV TZ=Europe/Berlin
WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/drizzle ./drizzle
# Run by Coolify's scheduled task and by hand; they import src/lib/server (and the
# pure helpers in src/lib/shared) directly.
COPY --from=build /app/scripts/schedule.ts /app/scripts/backup-db.ts /app/scripts/send-reminders.ts ./scripts/
COPY --from=build /app/src/lib/server ./src/lib/server
COPY --from=build /app/src/lib/shared ./src/lib/shared
COPY --from=build /app/src/data ./src/data
COPY --from=build /app/src/assets/mail ./src/assets/mail
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# The entrypoint starts as root only to hand /data to bun (a volume created by an
# older image is root's), then runs the server as bun. Scripts started with
# `docker exec` (the scheduled task runs as root) switch to bun themselves
# (RUN_AS, src/lib/server/run-as.ts), so the database and its WAL files always
# belong to one user.
ENV DATABASE_PATH=/data/mens-circle.db RUN_AS=bun
VOLUME ["/data"]
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8090/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
