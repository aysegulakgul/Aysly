import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Güvenlik ve yıkıcı işlem olayları (DATA_MODEL §3.14, SECURITY §7). Salt eklenir.
 * İçerik (başlık, not) veya e-posta yazılmaz; yalnızca kimlikler ve sayılar.
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id'),
    actorUserId: uuid('actor_user_id'),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    metadata: jsonb('metadata').notNull().default({}),
    ipHash: text('ip_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_actor_created_idx').on(t.actorUserId, t.createdAt),
    index('audit_workspace_created_idx').on(t.workspaceId, t.createdAt),
  ],
);
