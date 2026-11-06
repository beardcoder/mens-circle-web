# 0002: Route cache with purge on every mutation

**Status:** accepted.

**Context.** Home, `/event` and the event pages show live data (dates, seats,
voices) but are read far more often than anything changes.

**Decision.** Server-render them and keep them in Astro's `memoryCache` (keyed by
path, 64 entries, 5 min + 5 min stale-while-revalidate, tag `public`). Every action
that changes events, registrations or testimonials awaits `purgePublicCache()`, so
the lifetime only bounds what changes with the clock. Browsers and Cloudflare
revalidate (`max-age=0`, no `s-maxage`), because a purge cannot reach Cloudflare.

**Consequences.** Seat counts on a page are a snapshot; the registration action
checks capacity in its own transaction. A POST answer (the registration without
JavaScript) is never cached.

**Revisit when** there is more than one replica (the cache is per process).
