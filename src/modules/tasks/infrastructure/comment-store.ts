import { and, asc, count, eq, sql } from 'drizzle-orm';
import type { WorkspaceScope } from '@/modules/workspaces';
import type { DbExecutor } from '@/shared/db/client';
import type { CommentStore } from '../application/comments';
import { taskComments } from './schema';

const inTask = (scope: WorkspaceScope, taskId: string) =>
  and(eq(taskComments.workspaceId, scope.workspaceId), eq(taskComments.taskId, taskId));

export function createCommentStore(db: DbExecutor): CommentStore {
  return {
    async list(scope, taskId) {
      return db
        .select({
          id: taskComments.id,
          taskId: taskComments.taskId,
          authorUserId: taskComments.authorUserId,
          // Yazar adı kimlik modülünün tablosundan (yalnızca ad; modül sınırı için parametreli SQL).
          authorName: sql<
            string | null
          >`(select name from users where users.id = ${taskComments.authorUserId})`,
          body: taskComments.body,
          createdAt: taskComments.createdAt,
        })
        .from(taskComments)
        .where(inTask(scope, taskId))
        .orderBy(asc(taskComments.createdAt), asc(taskComments.id));
    },
    async count(scope, taskId) {
      const [row] = await db.select({ n: count() }).from(taskComments).where(inTask(scope, taskId));
      return row?.n ?? 0;
    },
    async insert(scope, c) {
      await db.insert(taskComments).values({
        id: c.id,
        workspaceId: scope.workspaceId,
        taskId: c.taskId,
        authorUserId: scope.userId,
        body: c.body,
        createdAt: c.now,
      });
      const [author] = await db.execute<{ name: string }>(
        sql`select name from users where id = ${scope.userId}`,
      );
      return {
        id: c.id,
        taskId: c.taskId,
        authorUserId: scope.userId,
        authorName: author?.name ?? null,
        body: c.body,
        createdAt: c.now,
      };
    },
    async removeOwn(scope, taskId, id) {
      const rows = await db
        .delete(taskComments)
        .where(
          and(
            inTask(scope, taskId),
            eq(taskComments.id, id),
            eq(taskComments.authorUserId, scope.userId),
          ),
        )
        .returning({ id: taskComments.id });
      return rows.length > 0;
    },
  };
}
