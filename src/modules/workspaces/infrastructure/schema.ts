import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from '@/modules/identity/infrastructure/schema';

/** Çalışma alanları ve üyelikler (DATA_MODEL §3.3–3.4, D-012). */
export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey(),
    type: text('type').notNull(),
    name: text('name').notNull(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('workspaces_type', sql`${t.type} in ('personal','shared')`),
    check('workspaces_name_length', sql`char_length(${t.name}) between 1 and 80`),
    // BR-WS-001: her kullanıcının tam olarak bir kişisel çalışma alanı vardır.
    uniqueIndex('workspaces_one_personal_per_owner')
      .on(t.ownerUserId)
      .where(sql`${t.type} = 'personal'`),
  ],
);

export const workspaceMemberships = pgTable(
  'workspace_memberships',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (t) => [
    check('memberships_role', sql`${t.role} in ('owner','admin','member','guest')`),
    check('memberships_status', sql`${t.status} in ('active','removed')`),
    uniqueIndex('memberships_one_active')
      .on(t.workspaceId, t.userId)
      .where(sql`${t.status} = 'active'`),
    index('memberships_user_status_idx').on(t.userId, t.status),
  ],
);
