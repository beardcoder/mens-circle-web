/// <reference path="../pb_data/types.d.ts" />

// routes_public.pb.js — public custom API routes.

// -------------------------------------------------------------------------
// POST /api/event/register
// -------------------------------------------------------------------------
routerAdd("POST", "/api/event/register", (e) => {
  const lib = require(`${__hooks}/lib.js`);
  try {
    const data = e.requestInfo().body || {};
    const eventId = data.event_id;
    const firstName = (data.first_name || "").trim();
    const lastName = (data.last_name || "").trim();
    const email = (data.email || "").trim().toLowerCase();
    const phone = (data.phone_number || "").trim();
    const privacy = data.privacy;

    // Honeypot: the form ships a hidden "website" field real users leave empty.
    // If a bot filled it, fake success (no record, no email) so it thinks it won.
    if (typeof data.website === "string" && data.website.trim() !== "") {
      const firstNameSafe = (data.first_name || "").trim();
      return e.json(200, {
        success: true,
        message: `Vielen Dank, ${firstNameSafe}! Deine Anmeldung war erfolgreich. Du erhältst in Kürze eine Bestätigung per E-Mail.`,
      });
    }

    if (privacy !== true && privacy !== "true" && privacy !== 1 && privacy !== "1") {
      return e.json(422, {
        success: false,
        message: "Bitte bestätige die Datenschutzerklärung.",
      });
    }
    if (!email || email.indexOf("@") === -1) {
      return e.json(422, {
        success: false,
        message: "Bitte gib eine gültige E-Mail-Adresse an.",
      });
    }
    if (!eventId) {
      return e.json(422, {
        success: false,
        message: "Es wurde keine Veranstaltung angegeben.",
      });
    }

    // Look up the event.
    let event = null;
    try {
      event = $app.findRecordById("events", eventId);
    } catch (notFound) {
      event = null;
    }
    if (!event || !event.getBool("is_published") || event.getString("deleted")) {
      return e.json(404, {
        success: false,
        message: "Diese Veranstaltung ist nicht verfügbar.",
      });
    }
    if (lib.isEventPast(event)) {
      return e.json(410, {
        success: false,
        message:
          "Diese Veranstaltung hat bereits stattgefunden. Eine Anmeldung ist nicht mehr möglich.",
      });
    }

    // Capacity / waitlist decision computed at submit time.
    const activeCount = lib.countActiveRegistrations($app, event.id);
    const isWaitlist = activeCount >= event.getInt("max_participants");
    const status = isWaitlist ? "waitlist" : "registered";

    // Upsert participant by email.
    const participant = lib.upsertParticipant($app, email, {
      first_name: firstName,
      last_name: lastName,
      phone: phone,
    });

    // Find an existing registration for (participant, event), including soft-deleted.
    let existing = null;
    try {
      existing = $app.findFirstRecordByFilter(
        "registrations",
        "participant = {:pid} && event = {:eid}",
        { pid: participant.id, eid: event.id }
      );
    } catch (none) {
      existing = null;
    }

    if (existing && !existing.getString("deleted")) {
      const msg =
        existing.getString("status") === "waitlist"
          ? "Du bist bereits auf der Warteliste für diese Veranstaltung."
          : "Du bist bereits für diese Veranstaltung angemeldet.";
      return e.json(409, { success: false, message: msg });
    }

    const nowIso = new Date().toISOString();
    if (existing) {
      // Restore the soft-deleted registration. Emails fire in the onCreate hook
      // only on create, so send the restore email inline here.
      existing.set("status", status);
      existing.set("registered_at", nowIso);
      existing.set("cancelled_at", null);
      existing.set("deleted", null);
      $app.save(existing);

      sendRegistrationEmails(lib, event, participant, status);
    } else {
      // Create a fresh registration; the onCreate hook sends the emails.
      const col = $app.findCollectionByNameOrId("registrations");
      const reg = new Record(col);
      reg.set("participant", participant.id);
      reg.set("event", event.id);
      reg.set("status", status);
      reg.set("registered_at", nowIso);
      $app.save(reg);
    }

    const message = isWaitlist
      ? `Du wurdest auf die Warteliste eingetragen, ${firstName}. Wir benachrichtigen dich per E-Mail, sobald ein Platz frei wird.`
      : `Vielen Dank, ${firstName}! Deine Anmeldung war erfolgreich. Du erhältst in Kürze eine Bestätigung per E-Mail.`;

    return e.json(200, { success: true, message: message });
  } catch (err) {
    $app.logger().error("/api/event/register failed", "error", String(err));
    return e.json(500, {
      success: false,
      message: "Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.",
    });
  }
});

// Helper to send registration emails inline (used on restore path).
function sendRegistrationEmails(lib, event, participant, status) {
  try {
    if (status === "waitlist") {
      const tpl = lib.renderWaitlistConfirmation(event, participant);
      lib.sendMail($app, {
        to: participant.getString("email"),
        subject: tpl.subject,
        html: tpl.html,
      });
    } else {
      const tpl = lib.renderRegistrationConfirmation(event, participant);
      lib.sendMail($app, {
        to: participant.getString("email"),
        subject: tpl.subject,
        html: tpl.html,
      });
    }
    const activeCount = lib.countActiveRegistrations($app, event.id);
    const adminTpl = lib.renderAdminNotification(event, participant, activeCount);
    lib.sendMail($app, {
      to: lib.config.MAIL_ADMIN_ADDRESS,
      subject: adminTpl.subject,
      html: adminTpl.html,
    });
  } catch (mailErr) {
    $app.logger().error("restore registration emails failed", "error", String(mailErr));
  }
}

// -------------------------------------------------------------------------
// POST /api/newsletter/subscribe
// -------------------------------------------------------------------------
routerAdd("POST", "/api/newsletter/subscribe", (e) => {
  const lib = require(`${__hooks}/lib.js`);
  try {
    const data = e.requestInfo().body || {};
    const email = (data.email || "").trim().toLowerCase();
    const name = (data.name || "").trim();

    // Honeypot: hidden "website" field; bots fill it. Fake success silently.
    if (typeof data.website === "string" && data.website.trim() !== "") {
      return e.json(200, {
        success: true,
        message:
          "Vielen Dank! Du hast dich erfolgreich für unseren Newsletter angemeldet. Schau in dein Postfach.",
      });
    }

    if (!email || email.indexOf("@") === -1) {
      return e.json(422, {
        success: false,
        message: "Bitte gib eine gültige E-Mail-Adresse an.",
      });
    }

    // Subscribers + sending live entirely in listmonk now. Forward the sign-up
    // to listmonk's admin API; it owns the (double) opt-in confirmation email.
    const result = lib.subscribeToListmonk(email, name);

    if (result.status === "exists") {
      return e.json(409, {
        success: false,
        message: "Diese E-Mail-Adresse ist bereits für den Newsletter angemeldet.",
      });
    }

    if (!result.ok) {
      return e.json(502, {
        success: false,
        message: "Die Anmeldung ist momentan nicht möglich. Bitte versuche es später erneut.",
      });
    }

    return e.json(200, {
      success: true,
      message:
        "Vielen Dank! Du hast dich erfolgreich für unseren Newsletter angemeldet. Schau in dein Postfach.",
    });
  } catch (err) {
    $app.logger().error("/api/newsletter/subscribe failed", "error", String(err));
    return e.json(500, {
      success: false,
      message: "Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.",
    });
  }
});

// -------------------------------------------------------------------------
// POST /api/testimonial/submit
// -------------------------------------------------------------------------
routerAdd("POST", "/api/testimonial/submit", (e) => {
  try {
    const data = e.requestInfo().body || {};
    const quote = (data.quote || "").trim();
    const authorName = (data.author_name || "").trim();
    const role = (data.role || "").trim();
    const email = (data.email || "").trim().toLowerCase();
    const privacy = data.privacy;

    // Honeypot: hidden "website" field; bots fill it. Fake success silently
    // (no testimonial record created).
    if (typeof data.website === "string" && data.website.trim() !== "") {
      return e.json(200, {
        success: true,
        message:
          "Vielen Dank! Dein Testimonial wurde eingereicht und wird nach Prüfung veröffentlicht.",
      });
    }

    if (privacy !== true && privacy !== "true" && privacy !== 1 && privacy !== "1") {
      return e.json(422, {
        success: false,
        message: "Bitte bestätige die Datenschutzerklärung.",
      });
    }
    if (quote.length < 10 || quote.length > 1000) {
      return e.json(422, {
        success: false,
        message: "Dein Testimonial muss zwischen 10 und 1000 Zeichen lang sein.",
      });
    }
    if (email && email.indexOf("@") === -1) {
      return e.json(422, {
        success: false,
        message: "Bitte gib eine gültige E-Mail-Adresse an.",
      });
    }

    const col = $app.findCollectionByNameOrId("testimonials");
    const rec = new Record(col);
    rec.set("quote", quote);
    rec.set("author_name", authorName);
    rec.set("role", role);
    if (email) rec.set("email", email);
    // Always forced unpublished / unmoderated.
    rec.set("is_published", false);
    rec.set("published_at", null);
    rec.set("sort_order", 0);
    $app.save(rec);

    return e.json(200, {
      success: true,
      message:
        "Vielen Dank! Dein Testimonial wurde eingereicht und wird nach Prüfung veröffentlicht.",
    });
  } catch (err) {
    $app.logger().error("/api/testimonial/submit failed", "error", String(err));
    return e.json(500, {
      success: false,
      message: "Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.",
    });
  }
});

// -------------------------------------------------------------------------
// GET /api/public/events/next
// -------------------------------------------------------------------------
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

// -------------------------------------------------------------------------
// GET /api/public/events
// All published events (past + upcoming) as public DTOs. Consumed by the
// static build to generate one page per event slug (getStaticPaths).
// -------------------------------------------------------------------------
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

// -------------------------------------------------------------------------
// GET /api/public/events/{slug}
// -------------------------------------------------------------------------
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

// -------------------------------------------------------------------------
// GET /api/public/events/{slug}/ics
// Hosted iCalendar (.ics) download for a published event. Replaces the broken
// email attachment path: confirmation/promotion emails link here instead.
// -------------------------------------------------------------------------
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
