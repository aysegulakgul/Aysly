import { and, count, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import type { DbExecutor } from '@/shared/db/client';
import { isUuid } from '@/shared/kernel/id';
import type { Notification, NotificationStore } from '../application/notifications';
import { notifications } from './schema';

type Row = typeof notifications.$inferSelect;
const toNotification = (row: Row): Notification => ({
  id: row.id,
  type: row.type as Notification['type'],
  workspaceId: row.workspaceId,
  entityType: row.entityType,
  entityId: row.entityId,
  payload: row.payload as Notification['payload'],
  readAt: row.readAt,
  createdAt: row.createdAt,
});

export function createNotificationStore(db: DbExecutor): NotificationStore {
  return {
    async create(n) {
      // BR-NOTIF-002: aynı (kullanıcı, dedupe_key) için ikinci kayıt oluşmaz.
      const rows = await db
        .insert(notifications)
        .values({
          id: n.id,
          userId: n.userId,
          workspaceId: n.workspaceId,
          type: n.type,
          entityType: n.entityType,
          entityId: n.entityId,
          payload: n.payload,
          dedupeKey: n.dedupeKey,
          createdAt: n.now,
        })
        .onConflictDoNothing({ target: [notifications.userId, notifications.dedupeKey] })
        .returning({ id: notifications.id });
      return rows.length > 0;
    },
    async list(userId, options) {
      const rows = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            options.unreadOnly ? isNull(notifications.readAt) : undefined,
            options.before ? lt(notifications.createdAt, options.before) : undefined,
          ),
        )
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(options.limit);
      return rows.map(toNotification);
    },
    async unreadCount(userId) {
      const [row] = await db
        .select({ n: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
      return row?.n ?? 0;
    },
    async setRead(userId, ids, readAt) {
      const valid = ids.filter(isUuid);
      if (valid.length === 0 && ids.length > 0) return 0;
      const rows = await db
        .update(notifications)
        .set({ readAt })
        .where(
          and(
            eq(notifications.userId, userId),
            ids.length ? inArray(notifications.id, valid) : isNull(notifications.readAt),
          ),
        )
        .returning({ id: notifications.id });
      return rows.length;
    },
  };
}

/** BR-NOTIF-003: 90 günden eski bildirimler silinir (bakım işi, D-053). İdempotent. */
export async function purgeOldNotifications(db: DbExecutor, before: Date): Promise<number> {
  const rows = await db
    .delete(notifications)
    .where(lt(notifications.createdAt, before))
    .returning({ id: notifications.id });
  return rows.length;
}
