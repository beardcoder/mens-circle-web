# Decisions

Short records of the choices that shape this repository: what was decided, why, and
what would make us revisit it.

| ADR                                       | Decision                                          |
| ----------------------------------------- | ------------------------------------------------- |
| [0001](0001-bun-adapter.md)               | Bun's own server via the Bun adapter, not Node    |
| [0002](0002-route-cache.md)               | Astro's route cache, purged by every mutation     |
| [0003](0003-sqlite-single-replica.md)     | SQLite with exactly one replica                   |
| [0004](0004-registration-confirmation.md) | No double opt-in for registrations; a cancel link |
