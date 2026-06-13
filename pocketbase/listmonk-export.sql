-- ===========================================================================
-- listmonk export view — Männerkreis Niederbayern/ Straubing
-- ===========================================================================
-- One-off helper to export the existing PocketBase newsletter subscribers in a
-- listmonk-friendly shape, BEFORE migration 1700000900 drops the
-- `newsletter_subscribers` / `newsletters` collections.
--
-- DO NOT ship this as a pb_migration: all pending migrations run on the next
-- deploy, so a bundled view would be created and then immediately dropped by
-- 1700000900. Use it manually instead.
--
-- ── How to use (PocketBase admin) ──────────────────────────────────────────
--   1. PocketBase admin (/_/) → Collections → New collection → type "View".
--   2. Name it e.g. `listmonk_export`, paste the SELECT below as the view query,
--      save. (Views are read-only; keep listRule/viewRule = superuser only —
--      this is PII.)
--   3. Open the collection → Export → CSV (or JSON).
--   4. In listmonk: Subscribers → Import → upload the CSV, map `email` / `name`
--      / `attributes`, pick the target list and the subscription status
--      (use "confirmed" for the active set below), then import.
--   5. Once the data is in listmonk, deploy migration 1700000900 to drop the
--      PocketBase collections, and delete this view again.
--
--   The admin CSV export also emits PocketBase's own `id` column — listmonk
--   ignores unmapped columns, so it can stay.
--
-- ── ACTIVE subscribers (import into listmonk as status "confirmed") ─────────
SELECT
  s.id AS id,
  p.email AS email,
  CASE
    WHEN trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) <> ''
      THEN trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))
    ELSE substr(p.email, 1, instr(p.email, '@') - 1)
  END AS name,
  json_object(
    'subscribed_at', s.subscribed_at,
    'confirmed_at',  s.confirmed_at,
    'source',        'pocketbase'
  ) AS attributes
FROM newsletter_subscribers s
JOIN participants p ON p.id = s.participant
WHERE (s.unsubscribed_at IS NULL OR s.unsubscribed_at = '')
  AND (s.deleted IS NULL OR s.deleted = '')
ORDER BY s.subscribed_at ASC;

-- ── UNSUBSCRIBED subscribers (optional, import as status "unsubscribed") ────
-- Swap the WHERE clause above for the one below in a second view if you also
-- want to carry over opt-outs so previously unsubscribed people are not mailed:
--
--   WHERE s.unsubscribed_at IS NOT NULL AND s.unsubscribed_at <> ''
--     AND (s.deleted IS NULL OR s.deleted = '')

-- ===========================================================================
-- Bonus: direct CSV export from the server (no view needed)
-- ===========================================================================
-- If you have shell access to the box, this writes a clean listmonk CSV with
-- exactly the email,name,attributes header straight from the SQLite database:
--
--   sqlite3 -header -csv pb_data/data.db "
--     SELECT
--       p.email AS email,
--       CASE
--         WHEN trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) <> ''
--           THEN trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,''))
--         ELSE substr(p.email,1,instr(p.email,'@')-1)
--       END AS name,
--       json_object('subscribed_at',s.subscribed_at,'source','pocketbase') AS attributes
--     FROM newsletter_subscribers s
--     JOIN participants p ON p.id = s.participant
--     WHERE (s.unsubscribed_at IS NULL OR s.unsubscribed_at='')
--       AND (s.deleted IS NULL OR s.deleted='');
--   " > listmonk-subscribers.csv
