import nodemailer from 'nodemailer';
import type { EmailSender } from './email-sender';

/** Yerel SMTP (Mailpit) adaptörü. Kimlik bilgisi ve TLS yoktur; yalnızca 127.0.0.1'e bağlanır. */
export function createSmtpEmailSender(options: {
  host: string;
  port: number;
  from: string;
}): EmailSender {
  const transport = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: false,
  });
  return {
    async send(message) {
      await transport.sendMail({ from: options.from, ...message });
    },
  };
}
