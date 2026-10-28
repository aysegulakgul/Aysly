import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { WorkspaceScope } from '@/modules/workspaces';
import type { DbExecutor } from '@/shared/db/client';
import { isUuid } from '@/shared/kernel/id';
import type { TaskChanges, TaskRepository } from '../application/ports';
import type { Priority, Task, TaskStatus } from '../domain/task';
import { tasks } from './schema';

type Row = typeof tasks.$inferSelect;

// Değerler veritabanı CHECK kısıtlarıyla sınırlıdır (schema.ts).
function toTask(row: Row): Task {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    parentTaskId: row.parentTaskId,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    priority: row.priority as Priority,
    startDate: row.startDate,
    due: row.dueDate
      ? {
          date: row.dueDate,
          time: row.dueTime ? row.dueTime.slice(0, 5) : null,
          timezone: row.timezone,
          at: row.dueAt,
        }
      : null,
    completedAt: row.completedAt,
    completedBy: row.completedBy,
    position: row.position,
    createdBy: row.createdBy,
    archivedAt: row.archivedAt,
    deletedAt: row.deletedAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Domain değişikliklerini kolonlara çevirir; `due` dört kolonu birlikte yazar (BR-DATE-001). */
function toColumns(changes: TaskChanges) {
  const { due, ...rest } = changes;
  if (due === undefined) return rest;
  return {
    ...rest,
    dueDate: due?.date ?? null,
    dueTime: due?.time ?? null,
    timezone: due?.timezone ?? null,
    dueAt: due?.at ?? null,
  };
}

/** Kapsam koşulu: çalışma alanı + çöpte değil. Her sorgu bundan geçer (ARCHITECTURE §6). */
const inScope = (scope: WorkspaceScope) =>
  and(eq(tasks.workspaceId, scope.workspaceId), isNull(tasks.deletedAt));

export function createDrizzleTaskRepository(db: DbExecutor): TaskRepository {
  return {
    async insert(scope, t) {
      const [row] = await db
        .insert(tasks)
        .values({
          id: t.id,
          workspaceId: scope.workspaceId,
          projectId: t.projectId,
          parentTaskId: t.parentTaskId,
          title: t.title,
          description: t.description,
          priority: t.priority,
          startDate: t.startDate,
          ...toColumns({ due: t.due }),
          position: t.position,
          createdBy: t.createdBy,
          createdAt: t.now,
          updatedAt: t.now,
        })
        .returning();
      return toTask(row!);
    },

    async findById(scope, id) {
      if (!isUuid(id)) return null;
      const [row] = await db
        .select()
        .from(tasks)
        .where(and(inScope(scope), eq(tasks.id, id)))
        .limit(1);
      return row ? toTask(row) : null;
    },

    async update(scope, id, expectedVersion, changes, now) {
      const [row] = await db
        .update(tasks)
        .set({ ...toColumns(changes), version: sql`${tasks.version} + 1`, updatedAt: now })
        .where(and(inScope(scope), eq(tasks.id, id), eq(tasks.version, expectedVersion)))
        .returning();
      return row ? toTask(row) : null;
    },

    async lastPosition(scope, projectId, parentTaskId) {
      const [row] = await db
        .select({ position: tasks.position })
        .from(tasks)
        .where(
          and(
            eq(tasks.workspaceId, scope.workspaceId),
            eq(tasks.projectId, projectId),
            parentTaskId ? eq(tasks.parentTaskId, parentTaskId) : isNull(tasks.parentTaskId),
          ),
        )
        .orderBy(desc(tasks.position))
        .limit(1);
      return row?.position ?? null;
    },

    async list(scope, filter) {
      const rows = await db
        .select()
        .from(tasks)
        .where(
          and(
            inScope(scope),
            isNull(tasks.archivedAt),
            isNull(tasks.parentTaskId),
            inArray(tasks.status, [...filter.statuses]),
            filter.projectId ? eq(tasks.projectId, filter.projectId) : undefined,
          ),
        )
        .orderBy(asc(tasks.position), asc(tasks.id));
      return rows.map(toTask);
    },
  };
}
