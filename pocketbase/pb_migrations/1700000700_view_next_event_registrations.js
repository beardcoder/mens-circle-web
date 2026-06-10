/// <reference path="../pb_data/types.d.ts" />

// Read-only VIEW collection for the admin dashboard: shows everyone registered
// for the NEXT upcoming published event (registered + waitlist + attended),
// with participant details. Browse it under Collections → next_event_registrations.
//
// "Next event" = the published, non-deleted event with the smallest future
// event_date. Ordered registered → attended → waitlist, then by signup time.
const VIEW_NAME = "next_event_registrations";

const VIEW_QUERY = `
  SELECT
    r.id                              AS id,
    p.first_name                      AS first_name,
    p.last_name                       AS last_name,
    p.email                           AS email,
    p.phone                           AS phone,
    r.status                          AS status,
    r.registered_at                   AS registered_at,
    e.title                           AS event_title,
    e.event_date                      AS event_date
  FROM registrations r
  JOIN participants p ON p.id = r.participant
  JOIN events e       ON e.id = r.event
  WHERE e.id = (
      SELECT id FROM events
      WHERE is_published = TRUE
        AND (deleted IS NULL OR deleted = '')
        AND event_date >= datetime('now', 'start of day')
      ORDER BY event_date ASC
      LIMIT 1
    )
    AND (r.deleted IS NULL OR r.deleted = '')
    AND r.status IN ('registered', 'waitlist', 'attended')
  ORDER BY
    CASE r.status
      WHEN 'registered' THEN 0
      WHEN 'attended'   THEN 1
      WHEN 'waitlist'   THEN 2
      ELSE 3
    END,
    r.registered_at ASC
`;

migrate((app) => {
  // Skip if already created.
  try {
    if (app.findCollectionByNameOrId(VIEW_NAME)) {
      return;
    }
  } catch (err) {
    // not found -> create
  }

  const collection = new Collection({
    type: "view",
    name: VIEW_NAME,
    // PII (names, emails, phones) -> superuser-only.
    listRule: null,
    viewRule: null,
    viewQuery: VIEW_QUERY,
  });

  app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId(VIEW_NAME);
    if (collection) {
      app.delete(collection);
    }
  } catch (err) {
    // already gone
  }
});
