import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from '@/modules/identity/infrastructure/schema';
import { projects } from '@/modules/projects/infrastructure/schema';
import { tasks } from '@/modules/tasks/infrastructure/schema';
import { workspaces } from '@/modules/workspaces/infrastructure/schema';

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

/**
 * Notlar (DATA_MODEL §3.10, D-042, D-090). Gövde Markdown; arama vektörü üretilmiş kolondur (D-022,
 * `aysly_search_text`: küçük harf + aksan ve Türkçe harf farkı yok).
 */
export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title'),
    body: text('body').notNull().default(''),
    pinnedAt: timestamp('pinned_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBatchId: uuid('deleted_batch_id'),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', aysly_search_text(title)), 'A') || setweight(to_tsvector('simple', aysly_search_text(body)), 'B')`,
    ),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('notes_workspace_id_unique').on(t.workspaceId, t.id),
    // BR-NOTE-004
    check(
      'notes_not_empty',
      sql`char_length(coalesce(${t.title}, '')) + char_length(${t.body}) > 0`,
    ),
    check('notes_title_length', sql`${t.title} is null or char_length(${t.title}) <= 200`),
    check('notes_body_length', sql`char_length(${t.body}) <= 200000`),
    index('notes_list_idx')
      .on(t.workspaceId, t.updatedAt)
      .where(sql`${t.deletedAt} is null`),
    index('notes_search_idx').using('gin', t.searchVector),
  ],
);

/** BR-NOTE-003: not ↔ görev (çoktan çoğa, aynı çalışma alanı). */
export const noteTaskLinks = pgTable(
  'note_task_links',
  {
    noteId: uuid('note_id').notNull(),
    taskId: uuid('task_id').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.noteId, t.taskId] }),
    foreignKey({
      name: 'note_task_links_note_fk',
      columns: [t.workspaceId, t.noteId],
      foreignColumns: [notes.workspaceId, notes.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'note_task_links_task_fk',
      columns: [t.workspaceId, t.taskId],
      foreignColumns: [tasks.workspaceId, tasks.id],
    }).onDelete('cascade'),
    index('note_task_links_task_idx').on(t.taskId),
  ],
);

/** BR-NOTE-003: not ↔ proje. */
export const noteProjectLinks = pgTable(
  'note_project_links',
  {
    noteId: uuid('note_id').notNull(),
    projectId: uuid('project_id').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.noteId, t.projectId] }),
    foreignKey({
      name: 'note_project_links_note_fk',
      columns: [t.workspaceId, t.noteId],
      foreignColumns: [notes.workspaceId, notes.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'note_project_links_project_fk',
      columns: [t.workspaceId, t.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
    }).onDelete('cascade'),
    index('note_project_links_project_idx').on(t.projectId),
  ],
);
