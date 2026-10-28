import { sql } from 'drizzle-orm';
import {
  check,
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
 * Görevler (DATA_MODEL §3.7). Tekrar alanları Faz 6'da, arama vektörü Faz 7'de eklenir (kullanılmayan kolon
 * eklenmez, CLAUDE.md §2.11). Proje ve ebeveyn bağlantıları `workspace_id` ile bileşiktir: görev başka çalışma
 * alanındaki projeye veya göreve bağlanamaz (BR-WS-002).
 */
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
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBatchId: uuid('deleted_batch_id'),
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
    index('tasks_trash_idx')
      .on(t.workspaceId, t.deletedAt)
      .where(sql`${t.deletedAt} is not null`),
  ],
);
