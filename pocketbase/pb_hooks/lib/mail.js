/// <reference path="../../pb_data/types.d.ts" />

// Mail helper + the hosted .ics download URL builder.

const { config } = require(`${__hooks}/lib/config.js`);

// Send an email. options: { to, subject, html }
// Never throws — logs and returns false on failure so callers don't 500.
//
// NOTE: We deliberately do NOT attach the .ics file. On the target PocketBase
// 0.39.3 JSVM, MailerMessage.attachments is map[string]io.Reader and the
// $filesystem.fileFromBytes(...) result cannot be converted to an io.Reader,
// which throws. Instead, the event calendar file is offered as a hosted
// download link (icsUrl) rendered inside the email templates.
function sendMail(app, options) {
  try {
    const msg = new MailerMessage({
      from: { address: config.MAIL_FROM_ADDRESS, name: config.MAIL_FROM_NAME },
      to: [{ address: options.to }],
      subject: options.subject,
      html: options.html,
    });

    app.newMailClient().send(msg);
    return true;
  } catch (e) {
    app.logger().error("sendMail failed", "to", options.to, "subject", options.subject, "error", String(e));
    return false;
  }
}

// Build the public hosted-download URL for an event's calendar (.ics) file.
function icsUrlFor(slug) {
  return `${config.APP_URL}/api/public/events/${slug}/ics`;
}

module.exports = { sendMail, icsUrlFor };
