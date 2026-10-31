import { authorize, type WorkspaceScope } from '@/modules/workspaces';
import { notFound, validationError, type DomainError } from '@/shared/kernel/errors';
import { isUuid } from '@/shared/kernel/id';
import { err, ok, type Result } from '@/shared/kernel/result';
import type { TaskDeps } from './ports';

/** BR-COMMENT-001 (D-099): yorum 1–5.000 karakter; görev başına en çok 500 yorum. */
export const COMMENT_MAX = 5000;
export const COMMENTS_PER_TASK = 500;

export type Comment = {
  id: string;
  taskId: string;
  authorUserId: string | null;
  authorName: string | null;
  body: string;
  createdAt: Date;
};

export type CommentStore = {
  list(scope: WorkspaceScope, taskId: string): Promise<Comment[]>;
  count(scope: WorkspaceScope, taskId: string): Promise<number>;
  insert(
    scope: WorkspaceScope,
    comment: { id: string; taskId: string; body: string; now: Date },
  ): Promise<Comment>;
  /** Yalnızca aktörün kendi yorumunu siler; silinen yoksa false. */
  removeOwn(scope: WorkspaceScope, taskId: string, id: string): Promise<boolean>;
};

export type CommentDeps = Pick<TaskDeps, 'tasks' | 'clock' | 'newId'> & { comments: CommentStore };

async function visibleTask(deps: CommentDeps, scope: WorkspaceScope, taskId: string) {
  return isUuid(taskId) ? deps.tasks.findById(scope, taskId) : null;
}

/** Görev yorumları, eskiden yeniye. Çöpteki görevin yorumları görünmez (BR-DEL-007). */
export async function listComments(
  deps: CommentDeps,
  scope: WorkspaceScope,
  taskId: string,
): Promise<Result<Comment[], DomainError>> {
  const allowed = authorize(scope, 'task.read');
  if (!allowed.ok) return allowed;
  if (!(await visibleTask(deps, scope, taskId))) return err(notFound());
  return ok(await deps.comments.list(scope, taskId));
}

/** BR-COMMENT-001: kırpılmış metin 1–5.000 karakter. */
export async function addComment(
  deps: CommentDeps,
  scope: WorkspaceScope,
  taskId: string,
  command: { body: string },
): Promise<Result<Comment, DomainError>> {
  const allowed = authorize(scope, 'task.update');
  if (!allowed.ok) return allowed;
  if (!(await visibleTask(deps, scope, taskId))) return err(notFound());
  const body = command.body.trim();
  if (body.length === 0) return err(validationError([{ field: 'body', reason: 'required' }]));
  if (body.length > COMMENT_MAX) {
    return err(validationError([{ field: 'body', reason: 'too_long' }]));
  }
  if ((await deps.comments.count(scope, taskId)) >= COMMENTS_PER_TASK) {
    return err(validationError([{ field: 'body', reason: 'limit_reached' }]));
  }
  return ok(
    await deps.comments.insert(scope, { id: deps.newId(), taskId, body, now: deps.clock.now() }),
  );
}

/** BR-COMMENT-001: yazan kendi yorumunu siler; başkasının yorumu bulunamadı sayılır. */
export async function deleteComment(
  deps: CommentDeps,
  scope: WorkspaceScope,
  taskId: string,
  id: string,
): Promise<Result<void, DomainError>> {
  const allowed = authorize(scope, 'task.update');
  if (!allowed.ok) return allowed;
  if (!isUuid(id) || !(await visibleTask(deps, scope, taskId))) return err(notFound());
  return (await deps.comments.removeOwn(scope, taskId, id)) ? ok(undefined) : err(notFound());
}
