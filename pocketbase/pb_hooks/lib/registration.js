/// <reference path="../../pb_data/types.d.ts" />

// Registration email orchestration shared by the register route (restore path)
// and the registrations onCreate hook: send the participant's confirmation or
// waitlist email, then the admin notification. All failures are logged inside
// sendMail and never bubble up.

const { config } = require(`${__hooks}/lib/config.js`);
const { sendMail } = require(`${__hooks}/lib/mail.js`);
const { countActiveRegistrations } = require(`${__hooks}/lib/domain.js`);
const {
  renderRegistrationConfirmation,
  renderWaitlistConfirmation,
  renderAdminNotification,
} = require(`${__hooks}/lib/emails.js`);

// Send the participant email (waitlist vs. confirmation) + the admin notification.
function sendRegistrationEmails(app, event, participant, status) {
  try {
    const tpl =
      status === "waitlist"
        ? renderWaitlistConfirmation(event, participant)
        : renderRegistrationConfirmation(event, participant);
    sendMail(app, {
      to: participant.getString("email"),
      subject: tpl.subject,
      html: tpl.html,
    });

    const activeCount = countActiveRegistrations(app, event.id);
    const adminTpl = renderAdminNotification(event, participant, activeCount);
    sendMail(app, {
      to: config.MAIL_ADMIN_ADDRESS,
      subject: adminTpl.subject,
      html: adminTpl.html,
    });
  } catch (mailErr) {
    app.logger().error("registration emails failed", "error", String(mailErr));
  }
}

module.exports = { sendRegistrationEmails };
