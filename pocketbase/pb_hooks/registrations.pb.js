/// <reference path="../pb_data/types.d.ts" />

// registrations.pb.js — transactional emails on registration create + waitlist
// promotion on cancel. All mail failures are logged, never block the record op.

// On create: send participant confirmation (registered) or waitlist confirmation
// (waitlist), and always send the admin notification.
onRecordAfterCreateSuccess((e) => {
  try {
    const lib = require(`${__hooks}/lib.js`);
    const reg = e.record;
    const status = reg.getString("status");

    if (status === "cancelled" || status === "attended") {
      // No emails for these on direct create.
      e.next();
      return;
    }

    let event = null;
    let participant = null;
    try {
      event = $app.findRecordById("events", reg.getString("event"));
      participant = $app.findRecordById("participants", reg.getString("participant"));
    } catch (lookupErr) {
      $app.logger().error("registration create: relation lookup failed", "error", String(lookupErr));
    }

    if (event && participant) {
      // Participant confirmation/waitlist email + admin notification.
      lib.sendRegistrationEmails($app, event, participant, status);
    }
  } catch (err) {
    $app.logger().error("registrations onCreate hook failed", "error", String(err));
  }
  e.next();
}, "registrations");

// On update: if status transitions to cancelled, promote the oldest waitlisted
// registration (FIFO by registered_at) and email them the promotion mail.
onRecordAfterUpdateSuccess((e) => {
  try {
    const lib = require(`${__hooks}/lib.js`);
    const reg = e.record;
    const newStatus = reg.getString("status");
    let oldStatus = "";
    try {
      oldStatus = reg.original().getString("status");
    } catch (origErr) {
      oldStatus = "";
    }

    if (oldStatus !== "cancelled" && newStatus === "cancelled") {
      const eventId = reg.getString("event");

      // Mirror the cancellation in listmonk: drop the participant from this
      // event's list so it reflects only current participants. Best-effort;
      // only this event's list is touched (newsletter + other events stay).
      try {
        const ev = $app.findRecordById("events", eventId);
        let listId = 0;
        try {
          listId = ev.getInt("listmonk_list_id");
        } catch (ignore) {
          listId = 0;
        }
        if (listId && listId > 0) {
          const p = $app.findRecordById("participants", reg.getString("participant"));
          lib.listmonkRemoveFromList(p.getString("email"), listId);
        }
      } catch (rmErr) {
        $app.logger().error("listmonk remove on cancel failed", "error", String(rmErr));
      }

      let next = null;
      try {
        const candidates = $app.findRecordsByFilter(
          "registrations",
          "event = {:eid} && status = 'waitlist' && deleted = null",
          "registered_at",
          1,
          0,
          { eid: eventId }
        );
        if (candidates && candidates.length > 0) {
          next = candidates[0];
        }
      } catch (findErr) {
        $app.logger().error("promotion: find waitlisted failed", "error", String(findErr));
      }

      if (next) {
        next.set("status", "registered");
        next.set("registered_at", new Date().toISOString());
        $app.save(next);

        try {
          const event = $app.findRecordById("events", eventId);
          const participant = $app.findRecordById("participants", next.getString("participant"));
          const tpl = lib.renderWaitlistPromotion(event, participant);
          lib.sendMail($app, {
            to: participant.getString("email"),
            subject: tpl.subject,
            html: tpl.html,
          });
        } catch (mailErr) {
          $app.logger().error("promotion email failed", "error", String(mailErr));
        }
      }
    }
  } catch (err) {
    $app.logger().error("registrations onUpdate hook failed", "error", String(err));
  }
  e.next();
}, "registrations");
