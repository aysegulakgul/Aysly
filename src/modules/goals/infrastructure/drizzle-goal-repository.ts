import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import type { WorkspaceScope } from '@/modules/workspaces';
import type { DbExecutor } from '@/shared/db/client';
import { isUuid } from '@/shared/kernel/id';
import type { GoalLinks, GoalRepository } from '../application/goals';
import type { Goal, GoalStatus, ProgressMode } from '../domain/goal';
import { goalProjectLinks, goalTaskLinks, goals } from './schema';

/** Arama vektörü okunmaz (üretilmiş kolon). */
const cols = {
  id: goals.id,
  workspaceId: goals.workspaceId,
  title: goals.title,
  description: goals.description,
  targetDate: goals.targetDate,
  status: goals.status,
  progressMode: goals.progressMode,
  manualProgress: goals.manualProgress,
  achievedAt: goals.achievedAt,
  archivedAt: goals.archivedAt,
  deletedAt: goals.deletedAt,
  deletedBatchId: goals.deletedBatchId,
  version: goals.version,
  createdAt: goals.createdAt,
  updatedAt: goals.updatedAt,
};
type Row = { [K in keyof typeof cols]: (typeof goals.$inferSelect)[K] };
const toGoal = (row: Row): Goal => ({
  ...row,
  status: row.status as GoalStatus,
  progressMode: row.progressMode as ProgressMode,
});

const inScope = (scope: WorkspaceScope) =>
  and(eq(goals.workspaceId, scope.workspaceId), isNull(goals.deletedAt));

export function createDrizzleGoalRepository(db: DbExecutor): GoalRepository {
  return {
    async insert(scope, g) {
      const [row] = await db
        .insert(goals)
        .values({
          id: g.id,
          workspaceId: scope.workspaceId,
          title: g.title,
          description: g.description,
          targetDate: g.targetDate,
          createdBy: scope.userId,
          createdAt: g.now,
          updatedAt: g.now,
        })
        .returning(cols);
      return toGoal(row!);
    },

    async findById(scope, id) {
      if (!isUuid(id)) return null;
      const [row] = await db
        .select(cols)
        .from(goals)
        .where(and(inScope(scope), eq(goals.id, id)))
        .limit(1);
      return row ? toGoal(row) : null;
    },

    async findAny(scope, id) {
      if (!isUuid(id)) return null;
      const [row] = await db
        .select(cols)
        .from(goals)
        .where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, id)))
        .limit(1);
      return row ? toGoal(row) : null;
    },

    async update(scope, id, expectedVersion, changes, now) {
      const [row] = await db
        .update(goals)
        .set({ ...changes, version: sql`${goals.version} + 1`, updatedAt: now })
        .where(
          and(
            inScope(scope),
            eq(goals.id, id),
            expectedVersion === null ? undefined : eq(goals.version, expectedVersion),
          ),
        )
        .returning(cols);
      return row ? toGoal(row) : null;
    },

    async list(scope, filter) {
      const rows = await db
        .select(cols)
        .from(goals)
        .where(
          and(
            inScope(scope),
            filter.includeArchived ? undefined : isNull(goals.archivedAt),
            filter.status ? eq(goals.status, filter.status) : undefined,
          ),
        )
        .orderBy(sql`${goals.targetDate} is null`, asc(goals.targetDate), desc(goals.updatedAt));
      return rows.map(toGoal);
    },

    async trash(scope, id, batchId, now) {
      if (!isUuid(id)) return false;
      const rows = await db
        .update(goals)
        .set({
          deletedAt: now,
          deletedBatchId: batchId,
          version: sql`${goals.version} + 1`,
          updatedAt: now,
        })
        .where(and(inScope(scope), eq(goals.id, id)))
        .returning({ id: goals.id });
      return rows.length > 0;
    },

    async restore(scope, id, now) {
      if (!isUuid(id)) return false;
      const rows = await db
        .update(goals)
        .set({
          deletedAt: null,
          deletedBatchId: null,
          version: sql`${goals.version} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(goals.workspaceId, scope.workspaceId),
            eq(goals.id, id),
            isNotNull(goals.deletedAt),
          ),
        )
        .returning({ id: goals.id });
      return rows.length > 0;
    },

    async listTrashed(scope) {
      const rows = await db
        .select(cols)
        .from(goals)
        .where(and(eq(goals.workspaceId, scope.workspaceId), isNotNull(goals.deletedAt)))
        .orderBy(desc(goals.deletedAt));
      return rows.map(toGoal);
    },

    async purge(scope, id) {
      if (id !== null && !isUuid(id)) return 0;
      const rows = await db
        .delete(goals)
        .where(
          and(
            eq(goals.workspaceId, scope.workspaceId),
            isNotNull(goals.deletedAt),
            id ? eq(goals.id, id) : undefined,
          ),
        )
        .returning({ id: goals.id });
      return rows.length;
    },

    async links(scope, goalIds) {
      const result = new Map<string, GoalLinks>();
      if (goalIds.length === 0) return result;
      const ensure = (id: string) => {
        if (!result.has(id)) result.set(id, { taskIds: [], projectIds: [] });
        return result.get(id)!;
      };
      const [taskRows, projectRows] = await Promise.all([
        db
          .select({ goalId: goalTaskLinks.goalId, id: goalTaskLinks.taskId })
          .from(goalTaskLinks)
          .where(
            and(
              eq(goalTaskLinks.workspaceId, scope.workspaceId),
              inArray(goalTaskLinks.goalId, [...goalIds]),
            ),
          ),
        db
          .select({ goalId: goalProjectLinks.goalId, id: goalProjectLinks.projectId })
          .from(goalProjectLinks)
          .where(
            and(
              eq(goalProjectLinks.workspaceId, scope.workspaceId),
              inArray(goalProjectLinks.goalId, [...goalIds]),
            ),
          ),
      ]);
      for (const r of taskRows) ensure(r.goalId).taskIds.push(r.id);
      for (const r of projectRows) ensure(r.goalId).projectIds.push(r.id);
      return result;
    },

    async setLinks(scope, goalId, links) {
      await db
        .delete(goalTaskLinks)
        .where(
          and(eq(goalTaskLinks.workspaceId, scope.workspaceId), eq(goalTaskLinks.goalId, goalId)),
        );
      await db
        .delete(goalProjectLinks)
        .where(
          and(
            eq(goalProjectLinks.workspaceId, scope.workspaceId),
            eq(goalProjectLinks.goalId, goalId),
          ),
        );
      if (links.taskIds.length) {
        await db
          .insert(goalTaskLinks)
          .values(
            links.taskIds.map((taskId) => ({ goalId, taskId, workspaceId: scope.workspaceId })),
          );
      }
      if (links.projectIds.length) {
        await db.insert(goalProjectLinks).values(
          links.projectIds.map((projectId) => ({
            goalId,
            projectId,
            workspaceId: scope.workspaceId,
          })),
        );
      }
    },
  };
}

/** Görev detayında bağlı hedefler (USER_FLOWS §2.7). */
export async function goalsLinkedToTask(
  db: DbExecutor,
  scope: WorkspaceScope,
  taskId: string,
): Promise<{ id: string; title: string }[]> {
  if (!isUuid(taskId)) return [];
  return db
    .select({ id: goals.id, title: goals.title })
    .from(goals)
    .innerJoin(goalTaskLinks, eq(goalTaskLinks.goalId, goals.id))
    .where(and(inScope(scope), eq(goalTaskLinks.taskId, taskId)));
}

/** BR-DEL-003: süresi dolan çöpteki hedefler (tüm alanlar; sistem işi). */
export async function purgeExpiredGoals(db: DbExecutor, before: Date): Promise<number> {
  const rows = await db
    .delete(goals)
    .where(and(isNotNull(goals.deletedAt), lt(goals.deletedAt, before)))
    .returning({ id: goals.id });
  return rows.length;
}
