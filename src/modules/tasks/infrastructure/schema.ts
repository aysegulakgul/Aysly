import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from '@/modules/identity/infrastructure/schema';
import { projects } from '@/modules/projects/infrastructure/schema';
import { workspaces } from '@/modules/workspaces/infrastructure/schema';

/**
 * Görevler (DATA_MODEL §3.7). Tekrar alanları Faz 6'da eklendi (D-087); arama vektörü Faz 7'de eklendi (D-022) (kullanılmayan kolon
 * eklenmez, CLAUDE.md §2.11). Proje ve ebeveyn bağlantıları `workspace_id` ile bileşiktir: görev başka çalışma
 * alanındaki projeye veya göreve bağlanamaz (BR-WS-002).
 */
const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    parentTaskId: uuid('parent_task_id'),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('todo'),
    priority: smallint('priority').notNull().default(0),
    startDate: date('start_date'),
    dueDate: date('due_date'),
    dueTime: time('due_time'),
    timezone: text('timezone'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    // Hesap silinince kişi bilgisi boşalır; kayıt sahibi çalışma alanıdır (D-068 ile aynı ilke).
    completedBy: uuid('completed_by').references(() => users.id, { onDelete: 'set null' }),
    position: text('position').notNull(),
    // BR-REC-* (D-087): tekrar kuralı yalnızca son tarihli üst düzey görevde.
    recurrenceRule: text('recurrence_rule'),
    recurrenceMode: text('recurrence_mode'),
    recurrenceSeriesId: uuid('recurrence_series_id'),
    recurrenceAnchor: date('recurrence_anchor'),
    recurrenceIndex: integer('recurrence_index'),
    recurrenceGeneratedFrom: uuid('recurrence_generated_from'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBatchId: uuid('deleted_batch_id'),
    // D-022: arama vektörü (başlık A, açıklama B; Türkçe harf ve aksan farkı yok, `aysly_search_text`).
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', aysly_search_text(title)), 'A') || setweight(to_tsvector('simple', aysly_search_text(description)), 'B')`,
    ),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('tasks_workspace_id_unique').on(t.workspaceId, t.id),
    foreignKey({
      name: 'tasks_project_fk',
      columns: [t.workspaceId, t.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'tasks_parent_fk',
      columns: [t.workspaceId, t.parentTaskId],
      foreignColumns: [t.workspaceId, t.id],
    }).onDelete('cascade'),
    // BR-TASK-001
    check('tasks_title_length', sql`char_length(btrim(${t.title})) between 1 and 500`),
    check(
      'tasks_description_length',
      sql`${t.description} is null or char_length(${t.description}) <= 20000`,
    ),
    // BR-TASK-003, BR-TASK-005
    check('tasks_status', sql`${t.status} in ('todo','in_progress','done')`),
    check('tasks_priority', sql`${t.priority} between 0 and 3`),
    // BR-TASK-004
    check(
      'tasks_completed_consistent',
      sql`(${t.status} = 'done') = (${t.completedAt} is not null)`,
    ),
    // BR-DATE-002
    check(
      'tasks_start_before_due',
      sql`${t.startDate} is null or ${t.dueDate} is null or ${t.startDate} <= ${t.dueDate}`,
    ),
    // BR-DATE-001
    check(
      'tasks_due_time_complete',
      sql`${t.dueTime} is null or (${t.dueDate} is not null and ${t.timezone} is not null and ${t.dueAt} is not null)`,
    ),
    check('tasks_not_own_parent', sql`${t.parentTaskId} is null or ${t.parentTaskId} <> ${t.id}`),
    // BR-REC-001
    check(
      'tasks_recurrence_valid',
      sql`${t.recurrenceRule} is null or (${t.dueDate} is not null and ${t.parentTaskId} is null and ${t.recurrenceMode} in ('fixed_schedule','after_completion') and ${t.recurrenceSeriesId} is not null and ${t.recurrenceAnchor} is not null and ${t.recurrenceIndex} >= 1)`,
    ),
    index('tasks_recurrence_generated_idx')
      .on(t.recurrenceGeneratedFrom)
      .where(sql`${t.recurrenceGeneratedFrom} is not null`),
    index('tasks_project_list_idx')
      .on(t.workspaceId, t.projectId, t.status, t.position)
      .where(sql`${t.deletedAt} is null`),
    index('tasks_due_date_idx')
      .on(t.workspaceId, t.dueDate)
      .where(sql`${t.deletedAt} is null and ${t.status} <> 'done' and ${t.archivedAt} is null`),
    index('tasks_due_at_idx')
      .on(t.workspaceId, t.dueAt)
      .where(sql`${t.deletedAt} is null and ${t.dueAt} is not null and ${t.status} <> 'done'`),
    index('tasks_parent_idx')
      .on(t.parentTaskId)
      .where(sql`${t.deletedAt} is null`),
    index('tasks_search_idx').using('gin', t.searchVector),
    index('tasks_trash_idx')
      .on(t.workspaceId, t.deletedAt)
      .where(sql`${t.deletedAt} is not null`),
  ],
);
