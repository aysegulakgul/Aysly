import { env } from '@/shared/config/env';
import { sqlClientInstance } from '@/shared/db/client';
import { createMemoryEmailSender, type EmailSender } from '@/shared/email/email-sender';
import { createSmtpEmailSender } from '@/shared/email/smtp-email-sender';
import { createPgAdvisoryLock } from '@/shared/jobs/pg-advisory-lock';
import { createInProcessScheduler, type Scheduler } from '@/shared/jobs/scheduler';
import { idempotencyCleanupJob } from '@/shared/http/idempotency';
import { logger } from '@/shared/observability/logger';
import { purgeExpiredTasks } from '@/modules/tasks';
import { db } from '@/shared/db/client';
import type { JobDefinition } from '@/shared/jobs/scheduler';

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
 * Bakım işleri (D-053). Kayıtlı: idempotency temizliği (D-019), 30 günlük çöp temizliği (BR-DEL-003).
 * Hesap silme Faz 8'de, bildirim temizliği Faz 6'da buraya kaydedilir.
 */
export function getScheduler(): Scheduler {
  if (!scheduler) {
    scheduler = createInProcessScheduler(createPgAdvisoryLock(sqlClientInstance()), logger());
    scheduler.register(idempotencyCleanupJob());
    scheduler.register(trashPurgeJob());
  }
  return scheduler;
}

/** BR-DEL-003 / D-035 / D-053: süresi (30 gün) dolan silme gruplarını saatlik kalıcı siler; açılışta da çalışır. */
export function trashPurgeJob(): JobDefinition {
  return {
    name: 'trash.purge',
    intervalMs: 60 * 60 * 1000,
    run: async () => {
      const before = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const purged = await purgeExpiredTasks(db(), before);
      if (purged > 0) logger().info({ purged }, 'süresi dolan çöp kayıtları silindi');
    },
  };
}
