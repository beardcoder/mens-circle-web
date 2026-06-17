/// <reference path="../pb_data/types.d.ts" />

// POST /api/event/register — public event registration with capacity/waitlist
// handling, participant upsert, and per-event listmonk list assignment.
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

      lib.sendRegistrationEmails($app, event, participant, status);
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

    // Best-effort: ensure this event's listmonk list exists and add the
    // participant to it (deduped by email; a person can be on the newsletter
    // and several event lists at once). Also sets the subscriber's name in
    // listmonk if it was still missing (e.g. a prior no-name newsletter
    // sign-up). Never blocks the registration response.
    try {
      const listId = lib.ensureEventListId($app, event);
      if (listId) {
        const fullName = `${firstName} ${lastName}`.trim();
        lib.listmonkAddToLists(email, fullName, [listId], true);
      }
    } catch (lmErr) {
      $app.logger().error("event listmonk assignment failed", "event", event.id, "error", String(lmErr));
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
