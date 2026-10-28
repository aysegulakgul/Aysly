import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { tasks } from '@/modules/tasks/infrastructure/schema';
import { workspaces } from '@/modules/workspaces/infrastructure/schema';

/** Etiketler (DATA_MODEL §3.8). `note_tags` notlarla birlikte Faz 7'de eklenir. */
export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // BR-TAG-001: Türkçe kurallarıyla küçük harf + aksan/nokta farkı yok sayılır (domain/tag.ts).
    nameNormalized: text('name_normalized').notNull(),
    color: text('color').notNull().default('slate'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('tags_workspace_name_unique').on(t.workspaceId, t.nameNormalized),
    unique('tags_workspace_id_unique').on(t.workspaceId, t.id),
    check('tags_name_length', sql`char_length(${t.name}) between 1 and 50`),
  ],
);

/** Görev–etiket bağlantısı; iki yabancı anahtar da `workspace_id` ile bileşiktir (BR-WS-002). */
export const taskTags = pgTable(
  'task_tags',
  {
    taskId: uuid('task_id').notNull(),
    tagId: uuid('tag_id').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.taskId, t.tagId] }),
    foreignKey({
      name: 'task_tags_task_fk',
      columns: [t.workspaceId, t.taskId],
      foreignColumns: [tasks.workspaceId, tasks.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'task_tags_tag_fk',
      columns: [t.workspaceId, t.tagId],
      foreignColumns: [tags.workspaceId, tags.id],
    }).onDelete('cascade'),
    index('task_tags_tag_idx').on(t.tagId),
  ],
);
