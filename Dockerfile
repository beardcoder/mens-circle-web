# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Männerkreis — single-image deploy.
#
# One process, one image: the Astro server runs in the Bun runtime (:8090, the
# exposed port, the public edge — no nginx) and serves the built static assets +
# prerendered HTML, the on-demand SSR pages, the /api/* backend (Bun + SQLite via
# Drizzle), transactional email and the reminder cron — all in-process. The data
# (SQLite file + uploaded images) lives in the mounted /data volume.
# ─────────────────────────────────────────────────────────────────────────────

# 1) Install dependencies + build the Astro server bundle with Bun.
#    NB: the build path is baked into the bundle (the adapter records the
#    absolute client dir), so the runtime stage MUST use the same WORKDIR.
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# Canonical URL for sitemap / OG tags (build-time only). Events + testimonials
# render on demand from the database — no content baked in, no rebuild on change.
ARG PUBLIC_SITE_URL
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL
# Plain `bun run build` (NOT `bun --bun run`): forcing the Bun runtime breaks
# Astro's Rollup build.
RUN bun run build

# 2) Final runtime image — just the Bun runtime + the built app.
FROM oven/bun:1
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tzdata wget \
  && rm -rf /var/lib/apt/lists/*
ENV TZ=Europe/Berlin
# Database + uploads live here (mount a volume). DATA_DIR drives DATABASE_PATH
# and UPLOAD_DIR (see src/server/config.ts).
ENV DATA_DIR=/data
# Same WORKDIR as the build stage so the adapter's baked client path resolves.
WORKDIR /app

# The Astro server bundle + its runtime dependencies + the static client.
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Persisted data (SQLite database + uploaded images) — mount a volume here.
VOLUME ["/data"]
# The Bun server is the public edge on :8090.
EXPOSE 8090

ENTRYPOINT ["docker-entrypoint.sh"]
