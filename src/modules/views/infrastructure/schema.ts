import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '@/modules/identity/infrastructure/schema';
import { workspaces } from '@/modules/workspaces/infrastructure/schema';

/**
 * Kayıtlı görünümler (DATA_MODEL §3.13, D-051): kişiseldir; filtre ve sıralama tanımını saklar, sonuç listesini
 * saklamaz (BR-VIEW-001). Takvim türü Faz 6'da eklenir; sabitleme kullanılmadığı için kolonu yoktur.
 */
export const savedViews = pgTable(
  'saved_views',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    viewType: text('view_type').notNull(),
    filter: jsonb('filter').notNull(),
    sort: text('sort').notNull().default('manual'),
    groupBy: text('group_by').notNull().default('none'),
    position: text('position').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('saved_views_name_length', sql`char_length(btrim(${t.name})) between 1 and 60`),
    check('saved_views_view_type', sql`${t.viewType} in ('list','board')`),
    index('saved_views_owner_idx').on(t.workspaceId, t.ownerUserId, t.position),
  ],
);
