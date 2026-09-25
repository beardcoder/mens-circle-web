# syntax=docker/dockerfile:1

FROM oven/bun:1 AS build
WORKDIR /app
# The workspace manifests must be present before install.
COPY package.json bun.lock ./
COPY packages/astro-bun/package.json ./packages/astro-bun/
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
COPY . .
ARG PUBLIC_SITE_URL
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL
# Build-time only: Astro embeds it in the server manifest. Keep it stable across builds.
ARG ASTRO_KEY
ENV ASTRO_KEY=$ASTRO_KEY
# No --bun: the Bun runtime breaks Rollup.
RUN bun run build

FROM oven/bun:1 AS production-deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/astro-bun/package.json ./packages/astro-bun/
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --production

FROM oven/bun:1
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tzdata wget \
  && rm -rf /var/lib/apt/lists/*
ENV TZ=Europe/Berlin
WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/drizzle ./drizzle
# Run by Coolify's scheduled task and by hand; they import src/lib/server directly.
COPY --from=build /app/scripts/schedule.ts /app/scripts/backup-db.ts /app/scripts/send-reminders.ts ./scripts/
COPY --from=build /app/scripts/lib ./scripts/lib
COPY --from=build /app/src/lib/server ./src/lib/server

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV DATABASE_PATH=/data/mens-circle.db
VOLUME ["/data"]
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8090/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
