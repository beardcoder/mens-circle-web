/// <reference path="../pb_data/types.d.ts" />

// Auto-generate a date-based slug for events (e.g. /event/2026-06-12), mirroring
// the original app. The slug is derived from event_date (YYYY-MM-DD) when the
// admin leaves it empty. Same-day collisions get a numeric suffix (-2, -3, …);
// a manually entered slug is always respected.
//
// NB: PocketBase JSVM hook handlers run in an isolated scope and cannot see
// other top-level functions in this file — so all logic is inlined here.
// Uses the *Request hooks because `slug` is a required field and must be set
// BEFORE validation runs.
function autoSlug(e) {
  try {
    const current = String(e.record.get("slug") || "").trim();
    if (!current) {
      const raw = String(e.record.get("event_date") || "");
      const base = raw.substring(0, 10); // "2026-06-12 19:00:..." -> "2026-06-12"
      if (/^\d{4}-\d{2}-\d{2}$/.test(base)) {
        let candidate = base;
        let n = 2;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          let found = null;
          try {
            found = $app.findFirstRecordByFilter("events", "slug = {:s}", {
              s: candidate,
            });
          } catch (notFound) {
            found = null; // slug is free
          }
          if (!found || (e.record.id && found.id === e.record.id)) break;
          candidate = base + "-" + n;
          n++;
        }
        e.record.set("slug", candidate);
      }
    }
  } catch (err) {
    $app.logger().error("event slug autogen failed", "error", String(err));
  }
  e.next();
}

onRecordCreateRequest(autoSlug, "events");
onRecordUpdateRequest(autoSlug, "events");

// On create: give every event its own listmonk list up front so the admin can
// see/prepare it even before the first registration. Idempotent + best-effort
// (a no-op when listmonk isn't configured); registration also ensures it as a
// fallback for events created before this hook existed.
onRecordAfterCreateSuccess((e) => {
  try {
    const lib = require(`${__hooks}/lib.js`);
    lib.ensureEventListId($app, e.record);
  } catch (err) {
    $app.logger().error("event listmonk list create failed", "error", String(err));
  }
  e.next();
}, "events");

// On update: keep the listmonk list label in sync when the event title or date
// changes. Only renames an already-created list; never creates one here.
onRecordAfterUpdateSuccess((e) => {
  try {
    const lib = require(`${__hooks}/lib.js`);
    const rec = e.record;
    let listId = 0;
    try {
      listId = rec.getInt("listmonk_list_id");
    } catch (ignore) {
      listId = 0;
    }
    if (listId && listId > 0) {
      let changed = false;
      try {
        const orig = rec.original();
        changed =
          orig.getString("title") !== rec.getString("title") ||
          String(orig.get("event_date")) !== String(rec.get("event_date"));
      } catch (origErr) {
        changed = false;
      }
      if (changed) {
        lib.listmonkRenameList(listId, lib.eventListName(rec));
      }
    }
  } catch (err) {
    $app.logger().error("event listmonk list rename failed", "error", String(err));
  }
  e.next();
}, "events");
