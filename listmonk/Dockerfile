# ===========================================================================
# listmonk — standalone app image (Männerkreis Niederbayern/ Straubing)
#
# Use this only if you deploy listmonk as a single "Dockerfile" resource and
# provide an EXTERNAL PostgreSQL via env vars (LISTMONK_db__*). For an all-in-
# one stack (app + Postgres) prefer docker-compose.yml in this folder.
#
# It just pins the official image, sets the timezone, and bakes the
# install → migrate → serve startup so the container is turnkey given a DB.
# ===========================================================================
FROM listmonk/listmonk:latest

ENV TZ=Europe/Berlin

EXPOSE 9000

# Required env at runtime (e.g. via Coolify):
#   LISTMONK_app__address=0.0.0.0:9000
#   LISTMONK_db__host, LISTMONK_db__port, LISTMONK_db__user,
#   LISTMONK_db__password, LISTMONK_db__database, LISTMONK_db__ssl_mode
#   LISTMONK_ADMIN_USER, LISTMONK_ADMIN_PASSWORD   (super admin on first boot)
#
# --config '' = configuration from env vars only (no config.toml).
CMD ["sh", "-c", "./listmonk --install --idempotent --yes --config '' && ./listmonk --upgrade --yes --config '' && ./listmonk --config ''"]
