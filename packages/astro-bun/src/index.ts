/**
 * Astro adapter for Bun. This file uses node:* only, so the integration also works when
 * Astro itself runs on Node; everything Bun-specific lives in the other modules.
 */
import type { AstroConfig, AstroIntegration, RouteToHeaders, ViteUserConfig } from 'astro';
import { readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANIFEST_FILE, type RuntimeConfig, type StaticHeaders } from './shared';

export interface BunAdapterOptions {
  /**
   * Extra headers per static file, e.g. a cache policy. Runs at build time after every
   * other integration's `astro:build:done`, so generated files (sitemaps, llms.txt) are
   * covered too. Headers a prerendered page set itself still win.
   */
  staticHeaders?: (pathname: string, context: { assets: string }) => Record<string, string> | null | undefined;
  /** Cache-Control for unhashed static files without their own. */
  staticCacheControl?: string;
}

const NAME = '@mens-circle/astro-bun';
const VIRTUAL_ID = `virtual:${NAME}/config`;
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

type Plugin = Extract<NonNullable<ViteUserConfig['plugins']>[number], { name: string }>;

function configPlugin(getConfig: () => RuntimeConfig): Plugin {
  return {
    name: `${NAME}:config`,
    // The package ships TypeScript source, so the server bundle must include it.
    configEnvironment: (environment: string) =>
      ['ssr', 'prerender', 'astro'].includes(environment) ? { resolve: { noExternal: [NAME] } } : undefined,
    resolveId: (id: string) => (id === VIRTUAL_ID ? RESOLVED_VIRTUAL_ID : undefined),
    load: (id: string) => (id === RESOLVED_VIRTUAL_ID ? `export default ${JSON.stringify(getConfig())};` : undefined),
  };
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => `/${relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/')}`);
}

/** `/impressum/index.html` → `/impressum`, the key Astro uses in `routeToHeaders`. */
const routeOf = (pathname: string): string =>
  pathname.endsWith('/index.html') ? pathname.slice(0, -'/index.html'.length) || '/' : pathname.replace(/\.html$/, '');

async function writeManifest(
  config: AstroConfig,
  routeHeaders: RouteToHeaders | undefined,
  staticHeaders: BunAdapterOptions['staticHeaders'],
): Promise<number> {
  const clientDir = fileURLToPath(config.build.client);
  const manifest: StaticHeaders = {};
  for (const pathname of await listFiles(clientDir)) {
    const headers = {
      ...staticHeaders?.(pathname, { assets: config.build.assets }),
      ...Object.fromEntries(routeHeaders?.get(routeOf(pathname))?.headers ?? []),
    };
    if (Object.keys(headers).length > 0) manifest[pathname] = headers;
  }
  await writeFile(new URL(MANIFEST_FILE, config.build.server), JSON.stringify(manifest));
  return Object.keys(manifest).length;
}

/** Astro's `image.service` for the Bun.Image service; see image-service.ts. */
export const bunImageService = () => ({ entrypoint: `${NAME}/image-service`, config: {} });

export default function bun(options: BunAdapterOptions = {}): AstroIntegration {
  let config: AstroConfig;
  let routeHeaders: RouteToHeaders | undefined;

  const runtimeConfig = (): RuntimeConfig => {
    if (!config) throw new Error(`${NAME}: config requested before astro:config:done`);
    const { host, port } = config.server;
    return {
      host: typeof host === 'string' ? host : host ? '0.0.0.0' : 'localhost',
      port,
      clientDir: relative(fileURLToPath(config.build.server), fileURLToPath(config.build.client)),
      assets: config.build.assets,
      staticCacheControl: options.staticCacheControl ?? 'public, max-age=86400, must-revalidate',
      trailingSlash: config.trailingSlash,
    };
  };

  // Appended by `updateConfig`, so its build:done runs after every integration that writes into dist/client.
  const finalizer: AstroIntegration = {
    name: `${NAME}:static-headers`,
    hooks: {
      'astro:build:done': async ({ logger }) => {
        if (config.output === 'static') return;
        const count = await writeManifest(config, routeHeaders, options.staticHeaders);
        logger.info(`Static headers written for ${count} file(s)`);
      },
    },
  };

  return {
    name: NAME,
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          // Config redirects are answered by the server instead of meta-refresh pages.
          build: { redirects: false },
          vite: { plugins: [configPlugin(runtimeConfig)] },
          integrations: [finalizer],
        });
      },
      'astro:config:done': ({ config: resolved, setAdapter }) => {
        config = resolved;
        setAdapter({
          name: NAME,
          serverEntrypoint: `${NAME}/server`,
          entrypointResolution: 'auto',
          adapterFeatures: { buildOutput: 'server', middlewareMode: 'classic', staticHeaders: true },
          supportedAstroFeatures: {
            hybridOutput: 'stable',
            staticOutput: 'stable',
            serverOutput: 'stable',
            sharpImageService: 'stable',
            envGetSecret: 'stable',
          },
        });
      },
      'astro:build:generated': ({ routeToHeaders }) => {
        routeHeaders = routeToHeaders;
      },
    },
  };
}
