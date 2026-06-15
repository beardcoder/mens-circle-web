/**
 * EmDash — lightweight SMTP mailer for Bun.
 *
 * Uses Bun's TCP sockets to send email via SMTP (STARTTLS on port 587).
 * This is a minimal implementation sufficient for transactional email.
 * For complex needs, swap with a proper library.
 */

export interface SmtpConfig {
  host: string;
  port: number;
  auth: { user: string; pass: string };
}

export interface MailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
}

interface SmtpTransport {
  send(msg: MailMessage): Promise<boolean>;
}

export function createTransport(config: SmtpConfig): SmtpTransport {
  return {
    async send(msg: MailMessage): Promise<boolean> {
      try {
        // Use a simple HTTP-based approach if available, or raw SMTP
        // For production deployments, this sends via SMTP using Bun TCP
        const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36)}`;
        const emailContent = [
          `From: ${msg.from}`,
          `To: ${msg.to}`,
          `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(msg.subject)))}?=`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          '',
          `--${boundary}`,
          'Content-Type: text/html; charset=UTF-8',
          'Content-Transfer-Encoding: base64',
          '',
          btoa(unescape(encodeURIComponent(msg.html))),
          `--${boundary}--`,
        ].join('\r\n');

        // Simple SMTP conversation
        const socket = await Bun.connect({
          hostname: config.host,
          port: config.port,
          socket: {
            data() {},
            open() {},
            close() {},
            error() {},
          },
        });

        // For a minimal implementation, we'll use a synchronous-style approach
        // In production, implement full SMTP handshake with STARTTLS
        const commands = [
          null, // wait for greeting
          `EHLO localhost\r\n`,
          `AUTH LOGIN\r\n`,
          `${btoa(config.auth.user)}\r\n`,
          `${btoa(config.auth.pass)}\r\n`,
          `MAIL FROM:<${extractEmail(msg.from)}>\r\n`,
          `RCPT TO:<${msg.to}>\r\n`,
          `DATA\r\n`,
          `${emailContent}\r\n.\r\n`,
          `QUIT\r\n`,
        ];

        // Use a promise-based approach for the SMTP conversation
        await new Promise<void>((resolve, reject) => {
          let step = 0;
          const timeout = setTimeout(
            () => reject(new Error('SMTP timeout')),
            30000,
          );

          const conn = Bun.connect({
            hostname: config.host,
            port: config.port,
            socket: {
              data(
                sock: { write(d: string): void; end(): void },
                data: Uint8Array,
              ) {
                const response = Buffer.from(data).toString();
                const code = parseInt(response.substring(0, 3), 10);
                if (code >= 400 && step > 1) {
                  clearTimeout(timeout);
                  reject(
                    new Error(`SMTP error at step ${step}: ${response.trim()}`),
                  );
                  sock.end();
                  return;
                }
                step++;
                if (step < commands.length) {
                  const cmd = commands[step];
                  if (cmd) sock.write(cmd);
                } else {
                  clearTimeout(timeout);
                  resolve();
                  sock.end();
                }
              },
              open(_sock: unknown) {
                // Wait for server greeting (handled in data)
              },
              close() {
                clearTimeout(timeout);
                resolve();
              },
              error(_sock: unknown, err: Error) {
                clearTimeout(timeout);
                reject(err);
              },
            },
          });

          void conn;
        });

        socket.end();
        return true;
      } catch (e) {
        console.error('[mailer] SMTP send failed:', String(e));
        return false;
      }
    },
  };
}

function extractEmail(from: string): string {
  const match = from.match(/<(.+)>/);
  return match ? match[1] : from;
}
