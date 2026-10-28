import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from '@/modules/identity/infrastructure/schema';
import { workspaces } from '@/modules/workspaces/infrastructure/schema';

/**
 * Projeler ve Inbox (DATA_MODEL §3.6, D-030). Faz 3'te yalnızca kayıtta oluşturulan Inbox kullanılır;
 * proje yönetimi Faz 5'te gelir.
 */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    color: text('color').notNull(),
    icon: text('icon'),
    status: text('status').notNull().default('active'),
    position: text('position').notNull(),
    // Hesap silinince oluşturan bilgisi boşalır; kayıt sahibi çalışma alanıdır (BR-ACC-005).
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBatchId: uuid('deleted_batch_id'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('projects_kind', sql`${t.kind} in ('inbox','standard')`),
    check('projects_status', sql`${t.status} in ('active','on_hold','completed')`),
    check('projects_name_length', sql`char_length(btrim(${t.name})) between 1 and 120`),
    check(
      'projects_description_length',
      sql`${t.description} is null or char_length(${t.description}) <= 5000`,
    ),
    // BR-PROJ-006 / D-030: Inbox arşivlenemez ve silinemez.
    check(
      'projects_inbox_protected',
      sql`${t.kind} <> 'inbox' or (${t.archivedAt} is null and ${t.deletedAt} is null)`,
    ),
    // Çapraz çalışma alanı kuralı için hazırlık: görev→proje bileşik yabancı anahtarlarının hedefi (Faz 4).
    unique('projects_workspace_id_unique').on(t.workspaceId, t.id),
    // BR-PROJ-006: her çalışma alanında tam olarak bir Inbox.
    uniqueIndex('projects_one_inbox_per_workspace')
      .on(t.workspaceId)
      .where(sql`${t.kind} = 'inbox'`),
    index('projects_workspace_position_idx')
      .on(t.workspaceId, t.position)
      .where(sql`${t.deletedAt} is null and ${t.archivedAt} is null`),
  ],
);
