/// <reference path="../pb_data/types.d.ts" />

// routes_admin.pb.js — superuser-only newsletter campaign send.
// POST /api/admin/newsletters/{id}/send
routerAdd("POST", "/api/admin/newsletters/{id}/send", (e) => {
  const lib = require(`${__hooks}/lib.js`);

  // Authorisation: require an authenticated superuser.
  const auth = e.auth;
  if (!auth || !auth.isSuperuser || !auth.isSuperuser()) {
    return e.json(403, {
      success: false,
      message: "Nicht autorisiert.",
    });
  }

  const id = e.request.pathValue("id");
  let newsletter = null;
  try {
    newsletter = $app.findRecordById("newsletters", id);
  } catch (notFound) {
    newsletter = null;
  }
  if (!newsletter) {
    return e.json(404, { success: false, message: "Newsletter nicht gefunden." });
  }
  if (newsletter.getString("status") === "sending") {
    return e.json(409, {
      success: false,
      message: "Dieser Newsletter wird bereits gesendet.",
    });
  }

  const subject = newsletter.getString("subject");
  const content = newsletter.getString("content");

  try {
    newsletter.set("status", "sending");
    $app.save(newsletter);

    let count = 0;
    const chunkSize = 100;
    let offset = 0;

    while (true) {
      let chunk = [];
      try {
        chunk = $app.findRecordsByFilter(
          "newsletter_subscribers",
          "unsubscribed_at = null && deleted = null",
          "subscribed_at",
          chunkSize,
          offset,
          {}
        );
      } catch (qErr) {
        $app.logger().error("newsletter chunk query failed", "error", String(qErr));
        chunk = [];
      }

      if (!chunk || chunk.length === 0) {
        break;
      }

      for (let i = 0; i < chunk.length; i++) {
        const sub = chunk[i];
        let participant = null;
        try {
          participant = $app.findRecordById("participants", sub.getString("participant"));
        } catch (pErr) {
          participant = null;
        }
        if (!participant) continue;

        const firstName = participant.getString("first_name") || "";
        const processed = content.split("{first_name}").join(lib.escapeHtml(firstName));
        const tpl = lib.renderNewsletterCampaign(subject, processed, sub.getString("token"));
        const ok = lib.sendMail($app, {
          to: participant.getString("email"),
          subject: tpl.subject,
          html: tpl.html,
        });
        if (ok) count++;
      }

      offset += chunk.length;
      if (chunk.length < chunkSize) break;
    }

    newsletter.set("status", "sent");
    newsletter.set("sent_at", new Date().toISOString());
    newsletter.set("recipient_count", count);
    $app.save(newsletter);

    return e.json(200, {
      success: true,
      message: `Newsletter an ${count} Empfänger gesendet.`,
      recipient_count: count,
    });
  } catch (err) {
    $app.logger().error("newsletter send failed", "error", String(err));
    try {
      newsletter.set("status", "draft");
      $app.save(newsletter);
    } catch (revertErr) {
      $app.logger().error("newsletter status revert failed", "error", String(revertErr));
    }
    return e.json(500, {
      success: false,
      message: "Beim Versand ist ein Fehler aufgetreten.",
    });
  }
});
