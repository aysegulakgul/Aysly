import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from '@/modules/identity/infrastructure/schema';
import { tasks } from '@/modules/tasks/infrastructure/schema';
import { workspaces } from '@/modules/workspaces/infrastructure/schema';

/** Hatırlatıcılar (DATA_MODEL §3.9, BR-REM-001..005). Görev silinince (kalıcı) birlikte silinir. */
export const reminders = pgTable(
  'reminders',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').notNull(),
    recipientUserId: uuid('recipient_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    offsetMinutes: integer('offset_minutes'),
    remindAt: timestamp('remind_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('pending'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: 'reminders_task_fk',
      columns: [t.workspaceId, t.taskId],
      foreignColumns: [tasks.workspaceId, tasks.id],
    }).onDelete('cascade'),
    // BR-REM-002
    unique('reminders_task_remind_at_unique').on(t.taskId, t.remindAt),
    check('reminders_kind', sql`${t.kind} in ('absolute','relative')`),
    check(
      'reminders_offset',
      sql`(${t.kind} = 'relative') = (${t.offsetMinutes} is not null) and (${t.offsetMinutes} is null or ${t.offsetMinutes} >= 0)`,
    ),
    check('reminders_status', sql`${t.status} in ('pending','sent','canceled','skipped')`),
    index('reminders_due_idx')
      .on(t.recipientUserId, t.remindAt)
      .where(sql`${t.status} = 'pending'`),
    index('reminders_task_idx').on(t.taskId),
  ],
);
