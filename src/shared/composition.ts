import { env } from '@/shared/config/env';
import { sqlClientInstance } from '@/shared/db/client';
import { createMemoryEmailSender, type EmailSender } from '@/shared/email/email-sender';
import { createSmtpEmailSender } from '@/shared/email/smtp-email-sender';
import { createPgAdvisoryLock } from '@/shared/jobs/pg-advisory-lock';
import { createInProcessScheduler, type Scheduler } from '@/shared/jobs/scheduler';
import { idempotencyCleanupJob } from '@/shared/http/idempotency';
import { logger } from '@/shared/observability/logger';
import { listExpiredTrashedProjects, purgeExpiredProjects } from '@/modules/projects';
import { purgeExpiredGoals } from '@/modules/goals';
import { purgeExpiredNotes } from '@/modules/notes';
import { purgeOldNotifications } from '@/modules/notifications';
import { purgeExpiredTasks, reassignTrashedTasks } from '@/modules/tasks';
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
 * 90 günlük bildirim temizliği (BR-NOTIF-003). Hesap silme Faz 8'de buraya kaydedilir.
 */
export function getScheduler(): Scheduler {
  if (!scheduler) {
    scheduler = createInProcessScheduler(createPgAdvisoryLock(sqlClientInstance()), logger());
    scheduler.register(idempotencyCleanupJob());
    scheduler.register(trashPurgeJob());
    scheduler.register(notificationPurgeJob());
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
      const purged = await db().transaction(async (tx) => {
        // BR-DEL-004: süresi dolan projede başka grupla çöpte kalan görevler Inbox'a bağlanır.
        await reassignTrashedTasks(tx, await listExpiredTrashedProjects(tx, before));
        return (
          (await purgeExpiredTasks(tx, before)) +
          (await purgeExpiredProjects(tx, before)) +
          (await purgeExpiredNotes(tx, before)) +
          (await purgeExpiredGoals(tx, before))
        );
      });
      if (purged > 0) logger().info({ purged }, 'süresi dolan çöp kayıtları silindi');
    },
  };
}

/** BR-NOTIF-003 / D-053: 90 günden eski bildirimleri günde bir siler; açılışta da çalışır. */
export function notificationPurgeJob(): JobDefinition {
  return {
    name: 'notifications.purge',
    intervalMs: 24 * 60 * 60 * 1000,
    run: async () => {
      const purged = await purgeOldNotifications(
        db(),
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      );
      if (purged > 0) logger().info({ purged }, 'eski bildirimler silindi');
    },
  };
}
