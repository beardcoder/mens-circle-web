/**
 * SMTP mail transport — the default {@link MailPort}. Uses nodemailer (works in
 * the Bun runtime). Replaces PocketBase's built-in mailer; SMTP is configured
 * via SMTP_* env vars instead of the PB settings UI.
 *
 * Never throws: a send failure is logged and returns `false`, so a failing
 * confirmation email never 500s the registration that triggered it (same
 * contract as the former `pb_hooks/lib/mail.js`). When SMTP is unconfigured it
 * logs the message instead of sending — handy in local dev.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config';
import type { MailMessage, MailPort } from '../ports';

let _transporter: Transporter | null = null;

function transporter(): Transporter | null {
  if (!config.SMTP_HOST) return null;
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    requireTLS: config.SMTP_TLS && config.SMTP_PORT !== 465,
    auth: config.SMTP_USERNAME
      ? { user: config.SMTP_USERNAME, pass: config.SMTP_PASSWORD }
      : undefined,
  });
  return _transporter;
}

export const smtpMailer: MailPort = {
  async send(message: MailMessage): Promise<boolean> {
    const tx = transporter();
    if (!tx) {
      console.warn(
        `[mail] SMTP not configured — skipping "${message.subject}" → ${message.to}`,
      );
      return false;
    }
    try {
      await tx.sendMail({
        from: {
          address: config.MAIL_FROM_ADDRESS,
          name: config.MAIL_FROM_NAME,
        },
        to: message.to,
        subject: message.subject,
        html: message.html,
      });
      return true;
    } catch (err) {
      console.error(
        `[mail] send failed → ${message.to} (${message.subject}):`,
        String(err),
      );
      return false;
    }
  },
};
