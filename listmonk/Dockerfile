# Custom listmonk image: bakes the branded system email-templates into the
# image so they ship with the container. This avoids relying on a runtime
# bind mount (./listmonk/static:/listmonk/static), which is fragile on some
# hosts (e.g. Coolify) and silently falls back to listmonk's embedded English
# defaults when the mount doesn't resolve.
#
# listmonk overlays files under <static-dir>/email-templates/ on top of the
# embedded defaults via a per-file merge (--static-dir). Only the files we
# ship here are overridden; everything else falls back to the binary.
FROM listmonk/listmonk:latest

# Copies static/email-templates/*.html (and any other static overrides) to the
# path referenced by --static-dir=/listmonk/static in docker-compose.yml.
COPY static /listmonk/static
