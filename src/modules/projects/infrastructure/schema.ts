import { sql } from 'drizzle-orm';
import {
  check,
  customType,
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
 * Projeler ve Inbox (DATA_MODEL §3.6, D-030). Proje yönetimi Faz 5'te (FR-PROJ); simge MVP'de seçilmez (D-082).
 */
const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

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
    // D-022: arama vektörü (ad A, açıklama B).
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', aysly_search_text(name)), 'A') || setweight(to_tsvector('simple', aysly_search_text(description)), 'B')`,
    ),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('projects_kind', sql`${t.kind} in ('inbox','standard')`),
    check('projects_status', sql`${t.status} in ('not_started','active','on_hold','completed')`),
    // UI_UX §2.4, D-082: sabit 12 renklik palet.
    check(
      'projects_color',
      sql`${t.color} in ('slate','red','orange','amber','green','teal','cyan','blue','indigo','violet','pink','brown')`,
    ),
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
    index('projects_search_idx').using('gin', t.searchVector),
    index('projects_workspace_position_idx')
      .on(t.workspaceId, t.position)
      .where(sql`${t.deletedAt} is null and ${t.archivedAt} is null`),
  ],
);
