import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { users } from '@/modules/identity/infrastructure/schema';
import { workspaces } from '@/modules/workspaces/infrastructure/schema';

/**
 * Uygulama içi bildirimler (DATA_MODEL §3.12, D-037). `entity_id` yabancı anahtar değildir (kayıt silinebilir);
 * `payload` görev başlığının anlık kopyasını taşır. `notification_deliveries` SONRA.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    payload: jsonb('payload').notNull(),
    // BR-NOTIF-002
    dedupeKey: text('dedupe_key').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('notifications_user_dedupe_unique').on(t.userId, t.dedupeKey),
    index('notifications_user_created_idx').on(t.userId, t.createdAt.desc()),
    index('notifications_unread_idx')
      .on(t.userId)
      .where(sql`${t.readAt} is null`),
  ],
);
