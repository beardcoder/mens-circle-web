/**
 * The production server: Bun.serve() around the handler that
 * @igloczek/astro-bun-adapter builds (`dist/server/entry.mjs`, standalone mode with
 * its autostart off). It serves like the adapter's own server (hashed `/assets/`
 * immutable, ETag/304, ranges, dotfiles and traversal refused) and adds one header:
 * a file without a Cache-Control of its own (prerendered pages, robots.txt, sw.js,
 * sitemaps) gets `public, max-age=0`, so browsers and Cloudflare revalidate it, as
 * they did under the Node adapter. Rendered pages bring theirs (lib/cache-policy.ts).
 */
interface Context {
  clientAddress?: string;
  serverPort?: number;
}

interface Entry {
  handler: (request: Request, context: Context) => Promise<Response>;
  options: { bodySizeLimit?: number; idleTimeout?: number; shutdownTimeout?: number };
}

process.env.ASTRO_BUN_AUTOSTART = 'disabled';

const entry = new URL('./dist/server/entry.mjs', import.meta.url).href;
const { handler, options } = (await import(entry)) as Entry;

const REVALIDATE = 'public, max-age=0';

const withCacheControl = (response: Response): Response => {
  if (response.headers.has('cache-control') || ![200, 206, 304].includes(response.status)) return response;

  const headers = new Headers(response.headers);

  headers.set('cache-control', REVALIDATE);

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

const hostname = process.env.HOST ?? 'localhost';

const server = Bun.serve({
  hostname,
  port: Number(process.env.PORT ?? 4321),
  ...(options.idleTimeout !== undefined && { idleTimeout: options.idleTimeout }),
  ...(options.bodySizeLimit !== undefined && { maxRequestBodySize: options.bodySizeLimit }),
  async fetch(request, bun) {
    const clientAddress = bun.requestIP(request)?.address;

    return withCacheControl(await handler(request, { clientAddress, serverPort: bun.port }));
  },
  error(error) {
    console.error(error);

    return new Response('Internal Server Error', { status: 500 });
  },
});

console.info(`Server listening on http://${hostname}:${server.port}`);

// Finish in-flight requests on SIGTERM (Coolify) or SIGINT, then exit; give up after
// the adapter's shutdown timeout.
let stopping = false;

const shutdown = (): void => {
  if (stopping) return;

  stopping = true;
  setTimeout(() => process.exit(1), (options.shutdownTimeout ?? 60) * 1000).unref();
  void server.stop().then(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
