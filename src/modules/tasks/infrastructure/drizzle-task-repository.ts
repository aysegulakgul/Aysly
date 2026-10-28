import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm';
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
    deletedBatchId: row.deletedBatchId,
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

    async countOpen(scope, projectId) {
      const [row] = await db
        .select({ n: count() })
        .from(tasks)
        .where(
          and(
            inScope(scope),
            eq(tasks.projectId, projectId),
            isNull(tasks.archivedAt),
            isNull(tasks.parentTaskId),
            ne(tasks.status, 'done'),
          ),
        );
      return row?.n ?? 0;
    },

    async listOpenInProjects(scope, projectIds) {
      if (projectIds.length === 0) return [];
      const rows = await db
        .select()
        .from(tasks)
        .where(
          and(
            inScope(scope),
            isNull(tasks.archivedAt),
            isNull(tasks.parentTaskId),
            ne(tasks.status, 'done'),
            inArray(tasks.projectId, [...projectIds]),
          ),
        )
        .orderBy(asc(tasks.dueDate), asc(tasks.dueAt), desc(tasks.priority), asc(tasks.position));
      return rows.map(toTask);
    },

    async listSubtasks(scope, parentId) {
      const rows = await db
        .select()
        .from(tasks)
        .where(and(inScope(scope), eq(tasks.parentTaskId, parentId)))
        .orderBy(asc(tasks.position), asc(tasks.id));
      return rows.map(toTask);
    },

    async subtaskCounts(scope, parentIds) {
      const counts = new Map<string, { total: number; done: number }>();
      if (parentIds.length === 0) return counts;
      const rows = await db
        .select({
          parentId: tasks.parentTaskId,
          total: count(),
          done: sql<number>`count(*) filter (where ${tasks.status} = 'done')`.mapWith(Number),
        })
        .from(tasks)
        .where(
          and(
            inScope(scope),
            isNull(tasks.archivedAt),
            inArray(tasks.parentTaskId, [...parentIds]),
          ),
        )
        .groupBy(tasks.parentTaskId);
      for (const row of rows) {
        if (row.parentId) counts.set(row.parentId, { total: row.total, done: row.done });
      }
      return counts;
    },

    async completeOpenSubtasks(scope, parentId, now, actorId) {
      await db
        .update(tasks)
        .set({
          status: 'done',
          completedAt: now,
          completedBy: actorId,
          version: sql`${tasks.version} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            inScope(scope),
            eq(tasks.parentTaskId, parentId),
            ne(tasks.status, 'done'),
            isNull(tasks.archivedAt),
          ),
        );
    },

    async moveSubtasks(scope, parentId, projectId, now) {
      await db
        .update(tasks)
        .set({ projectId, version: sql`${tasks.version} + 1`, updatedAt: now })
        .where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.parentTaskId, parentId)));
    },

    async progressFlags(scope, inboxId) {
      const [row] = await db
        .select({
          total: count(),
          inProject: sql<number>`count(*) filter (where ${tasks.projectId} <> ${inboxId})`.mapWith(
            Number,
          ),
          dated: sql<number>`count(*) filter (where ${tasks.dueDate} is not null)`.mapWith(Number),
        })
        .from(tasks)
        .where(inScope(scope));
      return {
        hasTask: (row?.total ?? 0) > 0,
        hasProjectTask: (row?.inProject ?? 0) > 0,
        hasDatedTask: (row?.dated ?? 0) > 0,
      };
    },

    async findAny(scope, id) {
      if (!isUuid(id)) return null;
      const [row] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, id)))
        .limit(1);
      return row ? toTask(row) : null;
    },

    async setArchived(scope, ids, archivedAt, now) {
      if (ids.length === 0) return 0;
      const rows = await db
        .update(tasks)
        .set({ archivedAt, version: sql`${tasks.version} + 1`, updatedAt: now })
        .where(and(inScope(scope), inArray(tasks.id, [...ids])))
        .returning({ id: tasks.id });
      return rows.length;
    },

    async subtasksArchivedWith(scope, parentId, archivedAt) {
      const rows = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(inScope(scope), eq(tasks.parentTaskId, parentId), eq(tasks.archivedAt, archivedAt)),
        );
      return rows.map((r) => r.id);
    },

    async trash(scope, ids, batchId, now) {
      if (ids.length === 0) return 0;
      const rows = await db
        .update(tasks)
        .set({
          deletedAt: now,
          deletedBatchId: batchId,
          version: sql`${tasks.version} + 1`,
          updatedAt: now,
        })
        .where(and(inScope(scope), inArray(tasks.id, [...ids])))
        .returning({ id: tasks.id });
      return rows.length;
    },

    async restore(scope, ids, now) {
      if (ids.length === 0) return 0;
      const rows = await db
        .update(tasks)
        .set({
          deletedAt: null,
          deletedBatchId: null,
          version: sql`${tasks.version} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(tasks.workspaceId, scope.workspaceId),
            inArray(tasks.id, [...ids]),
            isNotNull(tasks.deletedAt),
          ),
        )
        .returning({ id: tasks.id });
      return rows.length;
    },

    async batchMembers(scope, batchId) {
      if (!isUuid(batchId)) return [];
      const rows = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.workspaceId, scope.workspaceId),
            eq(tasks.deletedBatchId, batchId),
            isNotNull(tasks.deletedAt),
          ),
        );
      return rows.map(toTask);
    },

    async listTrash(scope) {
      const rows = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.workspaceId, scope.workspaceId), isNotNull(tasks.deletedAt)))
        .orderBy(desc(tasks.deletedAt));
      return rows.map(toTask);
    },

    async purge(scope, batchId) {
      if (batchId !== null && !isUuid(batchId)) return 0;
      // Alt görevler ebeveyn bağlantısıyla (ON DELETE CASCADE) birlikte silinir (BR-DEL-005).
      const rows = await db
        .delete(tasks)
        .where(
          and(
            eq(tasks.workspaceId, scope.workspaceId),
            isNotNull(tasks.deletedAt),
            batchId ? eq(tasks.deletedBatchId, batchId) : undefined,
          ),
        )
        .returning({ id: tasks.id });
      return rows.length;
    },
  };
}

/**
 * BR-DEL-003 / D-053: süresi dolan silme gruplarının kalıcı silinmesi (tüm çalışma alanları; sistem işi).
 * İdempotenttir: tekrar çalıştırıldığında silinecek kayıt kalmaz.
 */
export async function purgeExpiredTasks(db: DbExecutor, before: Date): Promise<number> {
  const rows = await db
    .delete(tasks)
    .where(and(isNotNull(tasks.deletedAt), lt(tasks.deletedAt, before)))
    .returning({ id: tasks.id });
  return rows.length;
}
