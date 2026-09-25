/**
 * The server entry Astro bundles into dist/server/entry.mjs. Importing it starts the
 * server. HOST and PORT override the Astro config at runtime.
 */
import { createApp } from 'astro/app/entrypoint';
import { setGetEnv } from 'astro/env/setup';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from 'virtual:@mens-circle/astro-bun/config';
import { MANIFEST_FILE, type StaticHeaders } from './shared';
import { createStaticRoutes } from './static';

setGetEnv((key) => process.env[key]);

const app = createApp();
const logger = app.adapterLogger;

// Resolved against this bundle, not the build machine, so dist/ can move.
const serverDir = fileURLToPath(new URL('.', import.meta.url));
const clientDir = join(serverDir, config.clientDir);
const manifest = Bun.file(join(serverDir, MANIFEST_FILE));

const routes = await createStaticRoutes({
  clientDir,
  assets: config.assets,
  staticCacheControl: config.staticCacheControl,
  compress: config.compress,
  headers: (await manifest.exists()) ? ((await manifest.json()) as StaticHeaders) : {},
});

/** Prerendered 404/500 pages, read from disk instead of fetched over HTTP from ourselves. */
async function errorPage(url: string): Promise<Response> {
  const base = new URL(url, 'http://localhost').pathname.replace(/(?:\/index)?\.html$|\/$/, '');
  for (const candidate of [`${base}.html`, `${base}/index.html`]) {
    const file = Bun.file(join(clientDir, candidate));
    if (await file.exists()) return new Response(file, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  return new Response(null, { status: 404 });
}

const server = Bun.serve({
  hostname: process.env.HOST ?? config.host,
  port: Number(process.env.PORT || config.port),
  development: false,
  routes,
  fetch: (request, server) =>
    app.render(request, {
      addCookieHeader: true,
      routeData: app.match(request),
      clientAddress: server.requestIP(request)?.address,
      prerenderedErrorPageFetch: errorPage,
    }),
  error(error) {
    logger.error(error.stack ?? String(error));
    return new Response('Internal Server Error', { status: 500 });
  },
});

// Deploys send SIGTERM: finish in-flight requests, then exit.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    logger.info(`${signal}: draining connections`);
    await server.stop();
    process.exit(0);
  });
}

logger.info(`Listening on ${server.url} (${Object.keys(routes).length} static routes)`);
