import { env } from '@/shared/config/env';
import { sqlClientInstance } from '@/shared/db/client';
import { createMemoryEmailSender, type EmailSender } from '@/shared/email/email-sender';
import { createSmtpEmailSender } from '@/shared/email/smtp-email-sender';
import { createPgAdvisoryLock } from '@/shared/jobs/pg-advisory-lock';
import { createInProcessScheduler, type Scheduler } from '@/shared/jobs/scheduler';
import { logger } from '@/shared/observability/logger';

/**
 * Bağımlılıkların elle bağlandığı tek yer (CODING_STANDARDS §2.1 — DI konteyneri yok).
 * Use case'ler bağımlılıklarını buradan parametre olarak alır.
 */
let emailSender: EmailSender | undefined;
export function getEmailSender(): EmailSender {
  if (!emailSender) {
    const config = env();
    emailSender =
      config.EMAIL_TRANSPORT === 'memory'
        ? createMemoryEmailSender()
        : createSmtpEmailSender({
            host: config.SMTP_HOST,
            port: config.SMTP_PORT,
            from: config.EMAIL_FROM,
          });
  }
  return emailSender;
}

let scheduler: Scheduler | undefined;
/**
 * Bakım işleri (D-053). Faz 2'de kayıtlı iş yoktur; çöp temizliği Faz 4'te, hesap silme Faz 8'de,
 * bildirim ve idempotency temizliği ilgili fazlarda buraya kaydedilir.
 */
export function getScheduler(): Scheduler {
  scheduler ??= createInProcessScheduler(createPgAdvisoryLock(sqlClientInstance()), logger());
  return scheduler;
}
