import { z } from 'zod';
import { findInboxRef, findProjectRef } from '@/modules/projects';
import { resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { db, type DbExecutor } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { idempotent } from '@/shared/http/idempotency';
import type { DomainError } from '@/shared/kernel/errors';
import { systemClock } from '@/shared/kernel/clock';
import { uuidv7 } from '@/shared/kernel/id';
import {
  completeTask,
  createTask,
  getTask,
  listTasks,
  reopenTask,
  updateTask,
  type TaskDeps,
} from '../application/tasks';
import { TASK_STATUSES, type Task } from '../domain/task';
import { createDrizzleTaskRepository } from '../infrastructure/drizzle-task-repository';

/** API_CONTRACTS §6. Gövdeler katıdır (§2.6); henüz desteklenmeyen alanlar (etiket, hatırlatıcı, tekrar) reddedilir. */
const Due = z.strictObject({
  date: z.string().max(20),
  time: z.string().max(10).nullable().optional(),
  timezone: z.string().max(100).nullable().optional(),
});
const Priority = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
const Fields = {
  title: z.string().max(2000),
  description: z.string().max(40_000).nullable(),
  priority: Priority,
  startDate: z.string().max(20).nullable(),
  due: Due.nullable(),
};
const CreateBody = z.strictObject({
  title: Fields.title,
  description: Fields.description.optional(),
  projectId: z.string().max(100).nullable().optional(),
  priority: Fields.priority.optional(),
  startDate: Fields.startDate.optional(),
  due: Fields.due.optional(),
});
const PatchBody = z.strictObject({
  version: z.number().int().positive(),
  title: Fields.title.optional(),
  description: Fields.description.optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: Fields.priority.optional(),
  startDate: Fields.startDate.optional(),
  due: Fields.due.optional(),
});
const VersionBody = z.strictObject({ version: z.number().int().positive() });

/** API görev nesnesi (API_CONTRACTS §6.3). Etiket, alt görev, hatırlatıcı ve tekrar alanları ilgili bölümlerde eklenir. */
export function toTaskJson(task: Task) {
  return {
    id: task.id,
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    parentTaskId: task.parentTaskId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    startDate: task.startDate,
    due: task.due ? { ...task.due, at: task.due.at?.toISOString() ?? null } : null,
    completedAt: task.completedAt?.toISOString() ?? null,
    position: task.position,
    archivedAt: task.archivedAt?.toISOString() ?? null,
    deletedAt: task.deletedAt?.toISOString() ?? null,
    version: task.version,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function taskDeps(executor: DbExecutor): TaskDeps {
  return {
    tasks: createDrizzleTaskRepository(executor),
    projects: {
      find: (scope, id) => findProjectRef(executor, scope, id),
      inbox: (scope) => findInboxRef(executor, scope),
    },
    clock: systemClock,
    newId: uuidv7,
  };
}

/** BR-TASK-010: sürüm çakışmasında güncel kayıt API biçiminde döner. */
function fail(ctx: ApiContext, error: DomainError) {
  return ctx.fail(
    error.kind === 'version_conflict' && error.current
      ? { kind: 'version_conflict', current: toTaskJson(error.current as Task) }
      : error,
  );
}

/** Çalışma alanı üyeliği yoksa 404 (BR-PERM-001). */
async function withScope(
  ctx: ApiContext,
  handle: (scope: WorkspaceScope) => Promise<Response>,
): Promise<Response> {
  const scope = await resolveWorkspaceScope(db(), ctx.actor.userId, ctx.params.ws ?? '');
  return scope ? handle(scope) : ctx.fail({ kind: 'not_found' });
}

export const postTask = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(CreateBody);
    if (!body.ok) return body.response;
    // BR-TASK-007: aynı anahtarla tekrar gönderimde tek görev oluşur, ilk yanıt aynen döner.
    return idempotent(ctx, body.data, async (tx) => {
      const result = await createTask(taskDeps(tx), scope, body.data);
      if (result.ok) return { status: 201, body: { data: toTaskJson(result.value) } };
      const failure = fail(ctx, result.error);
      return { status: failure.status, body: await failure.json() };
    });
  });

export const getTasks = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const query = new URL(ctx.request.url).searchParams;
    const statuses = query.getAll('status');
    const parsed = z.array(z.enum(TASK_STATUSES)).safeParse(statuses);
    if (!parsed.success) {
      return ctx.fail({ kind: 'validation', issues: [{ field: 'status', reason: 'invalid' }] });
    }
    const result = await listTasks(taskDeps(db()), scope, {
      projectId: query.get('projectId') ?? undefined,
      statuses: parsed.data,
    });
    return result.ok
      ? ctx.json(200, { data: result.value.map(toTaskJson) })
      : fail(ctx, result.error);
  });

export const getOneTask = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await getTask(taskDeps(db()), scope, ctx.params.id ?? '');
    return result.ok ? ctx.json(200, { data: toTaskJson(result.value) }) : fail(ctx, result.error);
  });

export const patchTask = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(PatchBody);
    if (!body.ok) return body.response;
    const result = await updateTask(taskDeps(db()), scope, ctx.params.id ?? '', body.data);
    return result.ok ? ctx.json(200, { data: toTaskJson(result.value) }) : fail(ctx, result.error);
  });

const transition = (use: typeof completeTask) => (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(VersionBody);
    if (!body.ok) return body.response;
    const result = await use(taskDeps(db()), scope, ctx.params.id ?? '', body.data);
    return result.ok ? ctx.json(200, { data: toTaskJson(result.value) }) : fail(ctx, result.error);
  });

export const postComplete = transition(completeTask);
export const postReopen = transition(reopenTask);
