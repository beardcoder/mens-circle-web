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
// Virtual module that hands the built server its build-time config (the client
// output dir). Replaces the deprecated `args` channel of the Astro 5 adapter
// API. The value is captured in `astro:config:done` and baked into the bundle.
const VIRTUAL_CONFIG_ID = 'virtual:mens-circle-edge/config';
const RESOLVED_VIRTUAL_CONFIG_ID = `\0${VIRTUAL_CONFIG_ID}`;

export default function bunEdgeAdapter() {
  // Absolute path to dist/client/, baked into the bundle (hence the build and
  // runtime stages must share a WORKDIR — see Dockerfile). Computed relative to
  // the entry is unreliable: the boot code is emitted into a hashed chunk under
  // dist/server/chunks/, so import.meta.url does not point at dist/server/.
  let clientDir = '';

  return {
    name: 'mens-circle-edge',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'mens-circle-edge:config',
                resolveId(id) {
                  if (id === VIRTUAL_CONFIG_ID) return RESOLVED_VIRTUAL_CONFIG_ID;
                },
                load(id) {
                  // clientDir is set in astro:config:done, which runs before the
                  // Vite build (and thus before this load) executes.
                  if (id === RESOLVED_VIRTUAL_CONFIG_ID) {
                    return `export const clientDir = ${JSON.stringify(clientDir)};`;
                  }
                },
              },
            ],
          },
        });
      },
      'astro:config:done': ({ setAdapter, config }) => {
        clientDir = fileURLToPath(config.build.client); // e.g. /app/dist/client/
        setAdapter({
          name: 'mens-circle-edge',
          // With `entrypointResolution: 'auto'` Astro uses this module itself as
          // the server entry (built to dist/server/entry.mjs): it imports the
          // manifest via `astro/app/entrypoint` and boots the Bun server at top
          // level — no `createExports()`/`start()`/`exports`/`args` (the
          // deprecated Astro 5 adapter API). Absolute path so Vite resolves it
          // during the SSR build.
          serverEntrypoint: fileURLToPath(new URL('./server.mjs', import.meta.url)),
          entrypointResolution: 'auto',
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
