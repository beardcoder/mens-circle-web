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

    const participant = lib.upsertParticipant($app, email, {});

    // Find an existing subscription (unique per participant), including soft-deleted.
    let existing = null;
    try {
      existing = $app.findFirstRecordByFilter(
        "newsletter_subscribers",
        "participant = {:pid}",
        { pid: participant.id }
      );
    } catch (none) {
      existing = null;
    }

    const nowIso = new Date().toISOString();

    if (existing && !existing.getString("deleted") && !existing.getString("unsubscribed_at")) {
      return e.json(409, {
        success: false,
        message: "Diese E-Mail-Adresse ist bereits für den Newsletter angemeldet.",
      });
    }

    if (existing) {
      // Reactivate / restore. The onCreate hook only fires on create, so send welcome inline.
      existing.set("token", lib.randomToken(64));
      existing.set("subscribed_at", nowIso);
      existing.set("confirmed_at", nowIso);
      existing.set("unsubscribed_at", null);
      existing.set("deleted", null);
      $app.save(existing);

      try {
        const tpl = lib.renderNewsletterWelcome(participant, existing.getString("token"));
        lib.sendMail($app, {
          to: participant.getString("email"),
          subject: tpl.subject,
          html: tpl.html,
        });
      } catch (mailErr) {
        $app.logger().error("newsletter welcome (restore) failed", "error", String(mailErr));
      }
    } else {
      // Fresh subscription; onCreate hook sends the welcome email.
      const col = $app.findCollectionByNameOrId("newsletter_subscribers");
      const sub = new Record(col);
      sub.set("participant", participant.id);
      sub.set("token", lib.randomToken(64));
      sub.set("subscribed_at", nowIso);
      sub.set("confirmed_at", nowIso);
      $app.save(sub);
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

// -------------------------------------------------------------------------
// GET /newsletter/unsubscribe/{token}
// -------------------------------------------------------------------------
routerAdd("GET", "/newsletter/unsubscribe/{token}", (e) => {
  const lib = require(`${__hooks}/lib.js`);
  const pageStyle =
    "font-family:'DM Sans',Helvetica,Arial,sans-serif;background-color:#efe9dd;color:#2c2418;" +
    "margin:0;padding:0;";
  const cardStyle =
    "max-width:560px;margin:64px auto;background:#ffffff;border-radius:8px;padding:48px 40px;" +
    "text-align:center;";

  function page(title, message) {
    return (
      `<!doctype html><html lang="de"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>${lib.escapeHtml(title)}</title></head>` +
      `<body style="${pageStyle}"><div style="${cardStyle}">` +
      `<h1 style="font-family:Georgia,serif;font-size:24px;color:#2c2418;margin:0 0 16px;">${lib.escapeHtml(title)}</h1>` +
      `<p style="font-size:16px;line-height:1.7;color:#5c4a3a;margin:0;">${lib.escapeHtml(message)}</p>` +
      `</div></body></html>`
    );
  }

  try {
    const token = e.request.pathValue("token");
    let sub = null;
    try {
      sub = $app.findFirstRecordByFilter(
        "newsletter_subscribers",
        "token = {:token}",
        { token: token }
      );
    } catch (none) {
      sub = null;
    }

    if (!sub) {
      return e.html(
        404,
        page(
          "Link ungültig",
          "Dieser Abmelde-Link ist leider ungültig oder abgelaufen."
        )
      );
    }

    sub.set("unsubscribed_at", new Date().toISOString());
    $app.save(sub);

    return e.html(
      200,
      page(
        "Abgemeldet",
        "Du wurdest erfolgreich vom Newsletter abgemeldet."
      )
    );
  } catch (err) {
    $app.logger().error("/newsletter/unsubscribe failed", "error", String(err));
    return e.html(
      500,
      page(
        "Fehler",
        "Es ist ein Fehler aufgetreten. Bitte versuche es später erneut."
      )
    );
  }
});

// ---------------------------------------------------------------------------
// Pretty deep-links for a specific event: /event/{slug} and /events/{slug}.
// The static site only ships /event/index.html (the "next event" shell). For a
// specific slug we redirect to that shell with a ?slug= query param, which the
// EventPage island reads to fetch and render the right event. Without this, the
// static SPA fallback would serve the home page for /event/{slug}.
// ---------------------------------------------------------------------------
function redirectToEventShell(e) {
  const slug = e.request.pathValue("slug");
  return e.redirect(302, "/event/?slug=" + encodeURIComponent(slug || ""));
}

routerAdd("GET", "/event/{slug}", redirectToEventShell);
routerAdd("GET", "/events/{slug}", redirectToEventShell);
