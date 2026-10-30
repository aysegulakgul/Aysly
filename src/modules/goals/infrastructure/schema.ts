import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
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

/** Hedefler (DATA_MODEL §3.11, BR-GOAL-001..004, D-034). */
export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    targetDate: date('target_date'),
    status: text('status').notNull().default('active'),
    progressMode: text('progress_mode').notNull().default('auto'),
    manualProgress: smallint('manual_progress'),
    achievedAt: timestamp('achieved_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBatchId: uuid('deleted_batch_id'),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', aysly_search_text(title)), 'A') || setweight(to_tsvector('simple', aysly_search_text(description)), 'B')`,
    ),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('goals_workspace_id_unique').on(t.workspaceId, t.id),
    check('goals_title_length', sql`char_length(btrim(${t.title})) between 1 and 200`),
    check(
      'goals_description_length',
      sql`${t.description} is null or char_length(${t.description}) <= 5000`,
    ),
    check('goals_status', sql`${t.status} in ('active','achieved','abandoned')`),
    check('goals_progress_mode', sql`${t.progressMode} in ('auto','manual')`),
    check(
      'goals_manual_progress',
      sql`${t.manualProgress} is null or ${t.manualProgress} between 0 and 100`,
    ),
    index('goals_list_idx')
      .on(t.workspaceId, t.status)
      .where(sql`${t.deletedAt} is null`),
    index('goals_search_idx').using('gin', t.searchVector),
  ],
);

/** BR-GOAL-004: hedef ↔ görev. */
export const goalTaskLinks = pgTable(
  'goal_task_links',
  {
    goalId: uuid('goal_id').notNull(),
    taskId: uuid('task_id').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.goalId, t.taskId] }),
    foreignKey({
      name: 'goal_task_links_goal_fk',
      columns: [t.workspaceId, t.goalId],
      foreignColumns: [goals.workspaceId, goals.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'goal_task_links_task_fk',
      columns: [t.workspaceId, t.taskId],
      foreignColumns: [tasks.workspaceId, tasks.id],
    }).onDelete('cascade'),
    index('goal_task_links_task_idx').on(t.taskId),
  ],
);

/** BR-GOAL-004: hedef ↔ proje. */
export const goalProjectLinks = pgTable(
  'goal_project_links',
  {
    goalId: uuid('goal_id').notNull(),
    projectId: uuid('project_id').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.goalId, t.projectId] }),
    foreignKey({
      name: 'goal_project_links_goal_fk',
      columns: [t.workspaceId, t.goalId],
      foreignColumns: [goals.workspaceId, goals.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'goal_project_links_project_fk',
      columns: [t.workspaceId, t.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
    }).onDelete('cascade'),
    index('goal_project_links_project_idx').on(t.projectId),
  ],
);
