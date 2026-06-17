/// <reference path="../pb_data/types.d.ts" />

// Public read-only event endpoints consumed by the Astro build + client.

// GET /api/public/events/next — the next upcoming published event (or null).
routerAdd("GET", "/api/public/events/next", (e) => {
  const lib = require(`${__hooks}/lib.js`);
  try {
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
    ).toISOString();

    let recs = [];
    try {
      recs = $app.findRecordsByFilter(
        "events",
        "is_published = true && deleted = null && event_date >= {:from}",
        "event_date",
        1,
        0,
        { from: startOfToday }
      );
    } catch (qErr) {
      recs = [];
    }

    if (!recs || recs.length === 0) {
      return e.json(200, { event: null });
    }
    return e.json(200, { event: lib.eventDto($app, recs[0]) });
  } catch (err) {
    $app.logger().error("/api/public/events/next failed", "error", String(err));
    return e.json(200, { event: null });
  }
});

// GET /api/public/events — all published events (past + upcoming) as public
// DTOs. Consumed by the static build to generate one page per event slug.
routerAdd("GET", "/api/public/events", (e) => {
  const lib = require(`${__hooks}/lib.js`);
  try {
    let recs = [];
    try {
      recs = $app.findRecordsByFilter(
        "events",
        "is_published = true && deleted = null",
        "event_date",
        500,
        0,
        {}
      );
    } catch (qErr) {
      recs = [];
    }
    const events = (recs || []).map((r) => lib.eventDto($app, r));
    return e.json(200, { events: events });
  } catch (err) {
    $app.logger().error("/api/public/events failed", "error", String(err));
    return e.json(200, { events: [] });
  }
});

// GET /api/public/events/{slug} — a single published event as a public DTO.
routerAdd("GET", "/api/public/events/{slug}", (e) => {
  const lib = require(`${__hooks}/lib.js`);
  try {
    const slug = e.request.pathValue("slug");
    let rec = null;
    try {
      rec = $app.findFirstRecordByFilter(
        "events",
        "slug = {:slug} && is_published = true && deleted = null",
        { slug: slug }
      );
    } catch (none) {
      rec = null;
    }

    if (!rec) {
      return e.json(404, { event: null });
    }
    return e.json(200, { event: lib.eventDto($app, rec) });
  } catch (err) {
    $app.logger().error("/api/public/events/{slug} failed", "error", String(err));
    return e.json(404, { event: null });
  }
});

// GET /api/public/events/{slug}/ics — hosted iCalendar (.ics) download for a
// published event. Confirmation/promotion emails link here.
routerAdd("GET", "/api/public/events/{slug}/ics", (e) => {
  const lib = require(`${__hooks}/lib.js`);
  try {
    const slug = e.request.pathValue("slug");
    let rec = null;
    try {
      rec = $app.findFirstRecordByFilter(
        "events",
        "slug = {:slug} && is_published = true && deleted = null",
        { slug: slug }
      );
    } catch (none) {
      rec = null;
    }

    if (!rec) {
      return e.json(404, { event: null });
    }

    const ics = lib.buildIcs(rec);
    if (!ics) {
      return e.json(404, { event: null });
    }

    // Set the filename via Content-Disposition; the calendar MIME type is set
    // explicitly through e.blob (which writes the Content-Type header for us).
    e.response
      .header()
      .set(
        "Content-Disposition",
        `attachment; filename="termin-${slug}.ics"`
      );
    return e.blob(200, "text/calendar; charset=utf-8", ics);
  } catch (err) {
    $app.logger().error("/api/public/events/{slug}/ics failed", "error", String(err));
    return e.json(404, { event: null });
  }
});

// The former GET /newsletter/unsubscribe/{token} route was removed: newsletter
// subscriptions live in listmonk now, which renders its own unsubscribe page
// and links it from every campaign footer.
