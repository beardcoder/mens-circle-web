/// <reference path="../pb_data/types.d.ts" />

// newsletter.pb.js — send the welcome email after a newsletter_subscribers
// record is created (covers fresh subscribe via the public route).
onRecordAfterCreateSuccess((e) => {
  try {
    const lib = require(`${__hooks}/lib.js`);
    const sub = e.record;

    let participant = null;
    try {
      participant = $app.findRecordById("participants", sub.getString("participant"));
    } catch (lookupErr) {
      $app.logger().error("newsletter welcome: participant lookup failed", "error", String(lookupErr));
    }

    if (participant) {
      const tpl = lib.renderNewsletterWelcome(participant, sub.getString("token"));
      lib.sendMail($app, {
        to: participant.getString("email"),
        subject: tpl.subject,
        html: tpl.html,
      });
    }
  } catch (err) {
    $app.logger().error("newsletter onCreate hook failed", "error", String(err));
  }
  e.next();
}, "newsletter_subscribers");
