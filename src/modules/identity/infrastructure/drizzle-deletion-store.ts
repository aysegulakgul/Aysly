import { and, eq, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { recordAuditEvent } from '@/modules/audit';
import type { Database } from '@/shared/db/client';
import { uuidv7 } from '@/shared/kernel/id';
import type { DeletionStore } from '../application/account-deletion';
import { authSessions, users } from './schema';

/**
 * BR-ACC-005 hesap silme deposu. Kullanıcı satırı silinince çalışma alanı, üyelikler, oturumlar, tercihler,
 * bildirimler, hatırlatıcılar, kayıtlı görünümler ve tüm içerik yabancı anahtar zinciriyle (ON DELETE CASCADE) silinir.
 * Yabancı anahtarı olmayan izler (denetim, sıfırlama kayıtları, hız sınırı sayaçları) burada açıkça temizlenir.
 */
export function createDrizzleDeletionStore(db: Database): DeletionStore {
  return {
    async markDeletionRequested(userId, now) {
      const [marked] = await db
        .update(users)
        .set({ deletionRequestedAt: now, updatedAt: now })
        .where(and(eq(users.id, userId), isNull(users.deletionRequestedAt)))
        .returning({ at: users.deletionRequestedAt });
      if (marked?.at) return marked.at;
      const [existing] = await db
        .select({ at: users.deletionRequestedAt })
        .from(users)
        .where(eq(users.id, userId));
      return existing?.at ?? now;
    },

    async clearDeletionRequest(userId, now) {
      await db
        .update(users)
        .set({ deletionRequestedAt: null, updatedAt: now })
        .where(eq(users.id, userId));
    },

    async deleteAllSessions(userId) {
      await db.delete(authSessions).where(eq(authSessions.userId, userId));
    },

    async listDueDeletions(requestedBefore) {
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            isNotNull(users.deletionRequestedAt),
            lte(users.deletionRequestedAt, requestedBefore),
          ),
        );
      return rows.map((r) => r.id);
    },

    purgeUser(userId, requestedBefore, now) {
      return db.transaction(async (tx) => {
        // Satır kilitlenir; talep bu arada iptal edildiyse veya kullanıcı zaten silindiyse dokunulmaz.
        const [due] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, userId), lte(users.deletionRequestedAt, requestedBefore)))
          .for('update');
        if (!due) return false;
        await tx.execute(sql`delete from audit_events where actor_user_id = ${userId}`);
        await tx.execute(sql`delete from auth_verifications where value = ${userId}`);
        await tx.execute(sql`delete from auth_rate_limits where key like ${`%:${userId}`}`);
        await tx.delete(users).where(eq(users.id, userId));
        // Denetimde kişisel veri ve kimlik içermeyen tek olay kalır.
        await recordAuditEvent(tx, {
          id: uuidv7(),
          action: 'account.deleted',
          actorUserId: null,
          now,
        });
        return true;
      });
    },
  };
}
