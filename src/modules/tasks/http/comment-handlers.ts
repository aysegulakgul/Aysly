import { z } from 'zod';
import { resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { db, type DbExecutor } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { systemClock } from '@/shared/kernel/clock';
import { uuidv7 } from '@/shared/kernel/id';
import {
  addComment,
  deleteComment,
  listComments,
  type Comment,
  type CommentDeps,
} from '../application/comments';
import { createCommentStore } from '../infrastructure/comment-store';
import { createDrizzleTaskRepository } from '../infrastructure/drizzle-task-repository';

const CommentBody = z.strictObject({ body: z.string().max(20_000) });

const deps = (executor: DbExecutor): CommentDeps => ({
  tasks: createDrizzleTaskRepository(executor),
  comments: createCommentStore(executor),
  clock: systemClock,
  newId: uuidv7,
});

export const toCommentJson = (c: Comment, actorId: string) => ({
  id: c.id,
  body: c.body,
  authorName: c.authorName,
  mine: c.authorUserId === actorId,
  createdAt: c.createdAt.toISOString(),
});
export type CommentView = ReturnType<typeof toCommentJson>;

async function withScope(ctx: ApiContext, handle: (scope: WorkspaceScope) => Promise<Response>) {
  const scope = await resolveWorkspaceScope(db(), ctx.actor.userId, ctx.params.ws ?? '');
  return scope ? handle(scope) : ctx.fail({ kind: 'not_found' });
}

/** GET /workspaces/{ws}/tasks/{id}/comments (D-099). */
export const getComments = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await listComments(deps(db()), scope, ctx.params.id ?? '');
    return result.ok
      ? ctx.json(200, { data: result.value.map((c) => toCommentJson(c, scope.userId)) })
      : ctx.fail(result.error);
  });

/** POST /workspaces/{ws}/tasks/{id}/comments `{ body }` (BR-COMMENT-001). */
export const postComment = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(CommentBody);
    if (!body.ok) return body.response;
    const result = await addComment(deps(db()), scope, ctx.params.id ?? '', body.data);
    return result.ok
      ? ctx.json(201, { data: toCommentJson(result.value, scope.userId) })
      : ctx.fail(result.error);
  });

/** DELETE /workspaces/{ws}/tasks/{id}/comments/{commentId}: yalnızca kendi yorumu. */
export const deleteOneComment = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await deleteComment(
      deps(db()),
      scope,
      ctx.params.id ?? '',
      ctx.params.commentId ?? '',
    );
    return result.ok ? new Response(null, { status: 204 }) : ctx.fail(result.error);
  });

/** Görev detayı (sunucu bileşeni) için yorumlar; uç noktayla aynı use case. */
export async function findComments(scope: WorkspaceScope, taskId: string) {
  const result = await listComments(deps(db()), scope, taskId);
  return result.ok ? result.value.map((c) => toCommentJson(c, scope.userId)) : [];
}
