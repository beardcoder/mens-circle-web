#!/bin/sh
# ---------------------------------------------------------------------------
# seed-templates.sh — provision the branded Männerkreis campaign template.
# ---------------------------------------------------------------------------
# listmonk loads CAMPAIGN templates only from its database, never from
# --static-dir (which overlays the file-based *system* e-mail templates). So
# the branded design has to be written straight into the `templates` table to
# actually be used for newsletters — that is what this one-shot service does.
#
# Idempotent: re-runs on every deploy. It upserts the template by name and
# (re)claims the single `is_default = true` slot so new campaigns pick it up
# automatically. The container then stays alive (sleep) so Coolify does not
# treat an exit-0 as a failure and restart it in a loop.
#
# Env (provided by docker-compose):
#   POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB   listmonk DB credentials
#   PGHOST (default listmonk-db) / PGPORT (default 5432)
#   TEMPLATE_NAME (default "Männerkreis Niederbayern")
#   TEMPLATE_FILE (default /seed/templates/mens-circle.html)
set -eu

TPL_NAME="${TEMPLATE_NAME:-Männerkreis Niederbayern}"
TPL_FILE="${TEMPLATE_FILE:-/seed/templates/mens-circle.html}"

export PGPASSWORD="${POSTGRES_PASSWORD}"
export PGHOST="${PGHOST:-listmonk-db}"
export PGPORT="${PGPORT:-5432}"
PSQL="psql -v ON_ERROR_STOP=1 --no-psqlrc -qtA -U ${POSTGRES_USER} -d ${POSTGRES_DB}"

# listmonk creates the `templates` table during `--install`. depends_on waits
# for the listmonk container to be healthy (i.e. install finished + server
# running), but guard against a race with a short retry loop anyway.
i=0
until $PSQL -c "SELECT to_regclass('public.templates');" 2>/dev/null | grep -q '^templates$'; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "seed-templates: templates table never appeared — giving up" >&2
    exit 1
  fi
  echo "seed-templates: waiting for listmonk schema… (${i})"
  sleep 2
done

if [ ! -f "$TPL_FILE" ]; then
  echo "seed-templates: template file not found: $TPL_FILE" >&2
  exit 1
fi
BODY="$(cat "$TPL_FILE")"

# psql's :'var' form safely quotes the value (single quotes doubled), so the
# HTML body — apostrophes and all — goes in without escaping headaches.
$PSQL -v name="$TPL_NAME" -v body="$BODY" <<'SQL'
BEGIN;

-- Insert once, then keep the body in sync on every deploy.
INSERT INTO templates (name, type, subject, body)
SELECT :'name', 'campaign', '', :'body'
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE name = :'name' AND type = 'campaign'
);

UPDATE templates
   SET body = :'body', updated_at = now()
 WHERE name = :'name' AND type = 'campaign';

-- Claim the single default slot (unique index: one is_default = true total).
-- Clearing first avoids tripping the index mid-transaction.
UPDATE templates SET is_default = false WHERE is_default = true;
UPDATE templates SET is_default = true  WHERE name = :'name' AND type = 'campaign';

COMMIT;
SQL

echo "seed-templates: provisioned campaign template \"${TPL_NAME}\" (set as default)."

# Stay alive so Coolify / Docker does not treat exit-0 as a failure and
# restart the container in a loop. A redeploy will recreate the container,
# which reruns the idempotent seed above before landing here again.
echo "seed-templates: container staying alive (redeploy will rerun seed)."
while true; do sleep 86400; done
