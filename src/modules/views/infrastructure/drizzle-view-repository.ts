import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import type { WorkspaceScope } from '@/modules/workspaces';
import type { DbExecutor } from '@/shared/db/client';
import { isUuid } from '@/shared/kernel/id';
import type { SavedView, ViewRepository } from '../application/views';
import {
  EMPTY_FILTER,
  TaskFilterSchema,
  type SortKey,
  type GroupKey,
  type ViewType,
} from '../domain/task-filter';
import { savedViews } from './schema';

type Row = typeof savedViews.$inferSelect;

/** Saklanan filtre şemadan geçer; okunamayan (ör. eski sürüm) filtre boş filtre sayılır. */
function toView(row: Row): SavedView {
  const filter = TaskFilterSchema.safeParse(row.filter);
  return {
    id: row.id,
    name: row.name,
    viewType: row.viewType as ViewType,
    filter: filter.success ? filter.data : EMPTY_FILTER,
    sort: row.sort as SortKey,
    groupBy: row.groupBy as GroupKey,
    position: row.position,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const owned = (scope: WorkspaceScope) =>
  and(eq(savedViews.workspaceId, scope.workspaceId), eq(savedViews.ownerUserId, scope.userId));

export function createDrizzleViewRepository(db: DbExecutor): ViewRepository {
  return {
    async list(scope) {
      const rows = await db
        .select()
        .from(savedViews)
        .where(owned(scope))
        .orderBy(asc(savedViews.position), asc(savedViews.id));
      return rows.map(toView);
    },

    async find(scope, id) {
      if (!isUuid(id)) return null;
      const [row] = await db
        .select()
        .from(savedViews)
        .where(and(owned(scope), eq(savedViews.id, id)))
        .limit(1);
      return row ? toView(row) : null;
    },

    async count(scope) {
      const [row] = await db.select({ n: count() }).from(savedViews).where(owned(scope));
      return row?.n ?? 0;
    },

    async lastPosition(scope) {
      const [row] = await db
        .select({ position: savedViews.position })
        .from(savedViews)
        .where(owned(scope))
        .orderBy(desc(savedViews.position))
        .limit(1);
      return row?.position ?? null;
    },

    async insert(scope, view, now) {
      const [row] = await db
        .insert(savedViews)
        .values({
          ...view,
          workspaceId: scope.workspaceId,
          ownerUserId: scope.userId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return toView(row!);
    },

    async update(scope, id, expectedVersion, changes, now) {
      if (!isUuid(id)) return null;
      const [row] = await db
        .update(savedViews)
        .set({ ...changes, version: sql`${savedViews.version} + 1`, updatedAt: now })
        .where(and(owned(scope), eq(savedViews.id, id), eq(savedViews.version, expectedVersion)))
        .returning();
      return row ? toView(row) : null;
    },

    async remove(scope, id) {
      if (!isUuid(id)) return false;
      const rows = await db
        .delete(savedViews)
        .where(and(owned(scope), eq(savedViews.id, id)))
        .returning({ id: savedViews.id });
      return rows.length > 0;
    },
  };
}
