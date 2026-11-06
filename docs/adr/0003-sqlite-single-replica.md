# 0003: SQLite and exactly one replica

**Status:** accepted.

**Context.** A few dozen events a year and a few hundred registrations; one small
server.

**Decision.** SQLite in WAL mode on a Docker volume, one container. Seat claims and
promotions run in synchronous `immediate` transactions; the rate limit, the route
cache and the geocoder's pacing live in the process.

**Consequences.** No database server to run or secure; backups are a `VACUUM INTO`
snapshot to S3. Scaling out would break the rate limit, the cache purge and the
transaction model and is not supported.

**Revisit when** load or availability needs more than one process: then Postgres,
a shared cache and a shared rate limit together.
