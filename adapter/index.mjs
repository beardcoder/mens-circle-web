import { fileURLToPath } from 'node:url';

/**
 * Local Astro adapter — "mens-circle-edge".
 *
 * The published Bun adapters (@nurodev/astro-bun) only target Astro ≤5 and
 * crash on Astro 6's `App` API. Since all we need is a thin Bun server, this
 * minimal adapter wires Astro's stable `astro/app` `App` into our own server
 * entry (adapter/server.mjs), which serves the built site AND reverse-proxies
 * the PocketBase paths — replacing nginx with a single Bun process.
 *
 * @returns {import('astro').AstroIntegration}
 */
export default function bunEdgeAdapter() {
  return {
    name: 'mens-circle-edge',
    hooks: {
      'astro:config:done': ({ setAdapter, config }) => {
        setAdapter({
          name: 'mens-circle-edge',
          // Absolute path so Vite resolves it during the SSR build.
          serverEntrypoint: fileURLToPath(
            new URL('./server.mjs', import.meta.url),
          ),
          // `start` is auto-invoked by Astro's generated entry → boots the
          // server. `handle` is exposed for completeness / testing.
          exports: ['start', 'handle'],
          // Baked into the bundle and read by server.mjs at runtime.
          args: {
            client: config.build.client.href, // file URL of dist/client/
            assets: config.build.assets, // hashed-asset dir name (e.g. "assets")
          },
          supportedAstroFeatures: {
            serverOutput: 'stable',
            staticOutput: 'stable',
            hybridOutput: 'stable',
            sharpImageService: 'stable',
            i18nDomains: 'unsupported',
            envGetSecret: 'stable',
          },
        });
      },
    },
  };
}
