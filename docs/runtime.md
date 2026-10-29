# Runtime and adapter

The official `@astrojs/node` 11.1.9 standalone adapter builds this Astro 7.4.2
project. Bun 1.4.4 runs the generated `dist/server/entry.mjs`; `HOST` and `PORT`
continue to work. Bun remains required by Drizzle's `bun:sqlite` backend and the
scheduler. A Node adapter does not require the Node executable to run the bundle.

The former workspace adapter and its custom static header manifest are removed.
The official adapter serves hashed build assets with `max-age=31536000, immutable`
and supplies static ETags/conditional requests. Unhashed assets and prerendered
HTML use its defaults and revalidation; the previous optional week/hour cache
optimizations are unnecessary for correctness. `staticHeaders` is not enabled.

Mail templates load three self-hosted fonts from a different origin. Their URLs
remain `/fonts/mail/*.woff2`; a whitelist endpoint reads `src/assets/mail` and
sets `Access-Control-Allow-Origin: *`, without cookies or authentication. These
public font responses also use native Astro caching. Docker copies these runtime
files explicitly. This preserves the one necessary cross-origin behavior without
an adapter-specific header mechanism or proxy configuration.

Astro sessions are disabled: existing authentication uses signed cookies and OIDC,
so the Node adapter's automatic filesystem session driver is unnecessary. The
adapter body limit is explicitly 1 MiB. Origin checks and the configured trusted
forwarded host remain enabled. No database migration or secret change is needed.

Verified locally with the built standalone server **executed by Bun** against a
disposable database: HTML and public JSON cache MISS/HIT, SSR image transformation,
immutable CSS, ETag/304, mail font CORS, health HEAD, admin redirect/private policy,
legacy redirects, rejected cross-site Action POSTs and unavailable/partial-data
responses. Existing tests cover OIDC, signed sessions and proxied origin checks.
The production Linux Docker image and a live OIDC/listmonk round trip were not run.

Deployment uses the existing Docker entrypoint and persistent `/data` volume.
Take the normal SQLite backup before rollout; the prior Git revision/image remains
a rollback option because the schema is unchanged. The official standalone server
uses its standard signal behavior; the custom adapter's explicit connection-drain
handler is no longer present.

References: [Astro Node adapter](https://docs.astro.build/en/guides/integrations-guide/node/),
[Astro with Bun](https://docs.astro.build/en/recipes/bun/).
