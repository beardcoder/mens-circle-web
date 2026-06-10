/// <reference path="../pb_data/types.d.ts" />

// cron.pb.js — event reminders. Runs every 15 minutes. Idempotent via reminder_sent_at.
cronAdd("event-reminders", "*/15 * * * *", () => {
  try {
    const lib = require(`${__hooks}/lib.js`);

    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
    );
    const endOfTomorrow = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 23, 59, 59)
    );

    // Active registrations whose reminder was not yet sent.
    let regs = [];
    try {
      regs = $app.findRecordsByFilter(
        "registrations",
        "(status = 'registered' || status = 'attended') && deleted = null && reminder_sent_at = null",
        "registered_at",
        500,
        0,
        {}
      );
    } catch (qErr) {
      $app.logger().error("cron reminders query failed", "error", String(qErr));
      regs = [];
    }

    for (let i = 0; i < regs.length; i++) {
      const reg = regs[i];
      try {
        const event = $app.findRecordById("events", reg.getString("event"));
        if (!event || !event.getBool("is_published") || event.getString("deleted")) {
          continue;
        }

        const eventDate = lib.toDate(event.get("event_date"));
        if (!eventDate) continue;
        if (eventDate.getTime() < startOfToday.getTime() || eventDate.getTime() > endOfTomorrow.getTime()) {
          continue;
        }

        const isToday =
          eventDate.getUTCFullYear() === startOfToday.getUTCFullYear() &&
          eventDate.getUTCMonth() === startOfToday.getUTCMonth() &&
          eventDate.getUTCDate() === startOfToday.getUTCDate();

        const participant = $app.findRecordById("participants", reg.getString("participant"));
        const tpl = lib.renderEventReminder(event, participant, isToday);
        lib.sendMail($app, {
          to: participant.getString("email"),
          subject: tpl.subject,
          html: tpl.html,
        });

        const nowIso = new Date().toISOString();
        reg.set("reminder_sent_at", nowIso);
        if (participant.getString("phone")) {
          // TODO: send SMS reminder via provider (e.g. seven.io) if phone present.
          reg.set("sms_reminder_sent_at", nowIso);
        }
        $app.save(reg);
      } catch (regErr) {
        $app.logger().error("cron reminder per-registration failed", "reg", reg.id, "error", String(regErr));
      }
    }
  } catch (err) {
    $app.logger().error("event-reminders cron failed", "error", String(err));
  }
});
