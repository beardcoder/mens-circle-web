# 0001: Bun's server via the Bun adapter

**Status:** accepted.

**Context.** The app needs `bun:sqlite` and runs its scheduled scripts on Bun. Under
`@astrojs/node` it ran Astro on Node's HTTP bridge inside Bun.

**Decision.** `@igloczek/astro-bun-adapter` in standalone mode, served by our own
`server.ts` on `Bun.serve()` (autostart off), which adds the cache header for static
files and the security headers. The adapter is bundled and stays a dev dependency.

**Consequences.** Faster static files and SSR and about half the memory
(`docs/runtime.md`). `server.ts` depends on the adapter's internal handler shape, so
adapter updates are never auto-merged and are checked with `test:pages` and the
browser check.

**Revisit when** the adapter stops being maintained or Astro ships an official Bun
adapter.
