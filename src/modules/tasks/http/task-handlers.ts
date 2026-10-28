import { z } from 'zod';
import { findUserPreferences } from '@/modules/preferences';
import { findInboxRef, findProjectRef, listActiveProjects } from '@/modules/projects';
import { countTags, findTagsForTasks, missingTagNames, replaceTaskTags } from '@/modules/tags';
import { resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { db, type DbExecutor } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { idempotent } from '@/shared/http/idempotency';
import { systemClock } from '@/shared/kernel/clock';
import type { DomainError } from '@/shared/kernel/errors';
import { uuidv7 } from '@/shared/kernel/id';
import type { Result } from '@/shared/kernel/result';
import {
  detachTask,
  getTaskDetail,
  listSummaries,
  moveTask,
  myTasks,
  type TaskSummary,
} from '../application/organize';
import {
  completeTask,
  createTask,
  listTasks,
  reopenTask,
  updateTask,
  type TaskDeps,
} from '../application/tasks';
import { todayIn } from '../domain/schedule';
import { TASK_STATUSES, type Task } from '../domain/task';
import { createDrizzleTaskRepository } from '../infrastructure/drizzle-task-repository';

/** API_CONTRACTS §6. Gövdeler katıdır (§2.6); henüz desteklenmeyen alanlar (hatırlatıcı, tekrar) reddedilir. */
const Due = z.strictObject({
  date: z.string().max(20),
  time: z.string().max(10).nullable().optional(),
  timezone: z.string().max(100).nullable().optional(),
});
const Priority = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
const TagNames = z.array(z.string().max(200)).max(100);
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
  parentTaskId: z.string().max(100).nullable().optional(),
  priority: Fields.priority.optional(),
  startDate: Fields.startDate.optional(),
  due: Fields.due.optional(),
  tagNames: TagNames.optional(),
});
const PatchBody = z.strictObject({
  version: z.number().int().positive(),
  title: Fields.title.optional(),
  description: Fields.description.optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: Fields.priority.optional(),
  startDate: Fields.startDate.optional(),
  due: Fields.due.optional(),
  tagNames: TagNames.optional(),
});
const VersionBody = z.strictObject({ version: z.number().int().positive() });
const CompleteBody = z.strictObject({
  version: z.number().int().positive(),
  completeSubtasks: z.boolean().optional(),
});
const MoveBody = z.strictObject({
  version: z.number().int().positive(),
  projectId: z.string().max(100),
});

/** API görev nesnesi (API_CONTRACTS §6.3). Hatırlatıcı ve tekrar alanları Faz 6'da eklenir. */
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

export function toSummaryJson(summary: TaskSummary) {
  return {
    ...toTaskJson(summary.task),
    project: summary.project,
    tags: summary.tags,
    subtaskCount: summary.subtasks,
  };
}

export function taskDeps(executor: DbExecutor): TaskDeps {
  return {
    tasks: createDrizzleTaskRepository(executor),
    projects: {
      find: (scope, id) => findProjectRef(executor, scope, id),
      inbox: (scope) => findInboxRef(executor, scope),
      listActive: (scope) => listActiveProjects(executor, scope),
    },
    tags: {
      replace: (scope, taskId, names, now) => replaceTaskTags(executor, scope, taskId, names, now),
      forTasks: (scope, ids) => findTagsForTasks(executor, scope, ids),
      missing: (scope, names) => missingTagNames(executor, scope, names),
      count: (scope) => countTags(executor, scope),
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

const reply = (ctx: ApiContext, result: Result<Task, DomainError>) =>
  result.ok ? ctx.json(200, { data: toTaskJson(result.value) }) : fail(ctx, result.error);

/** Çalışma alanı üyeliği yoksa 404 (BR-PERM-001). */
async function withScope(
  ctx: ApiContext,
  handle: (scope: WorkspaceScope) => Promise<Response>,
): Promise<Response> {
  const scope = await resolveWorkspaceScope(db(), ctx.actor.userId, ctx.params.ws ?? '');
  return scope ? handle(scope) : ctx.fail({ kind: 'not_found' });
}

/** Birden çok satırı değiştiren işlemler tek veritabanı işleminde çalışır (ör. alt görevler, etiketler). */
const inTransaction = <T>(run: (deps: TaskDeps) => Promise<T>) =>
  db().transaction((tx) => run(taskDeps(tx)));

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
    const parsed = z.array(z.enum(TASK_STATUSES)).safeParse(query.getAll('status'));
    if (!parsed.success) {
      return ctx.fail({ kind: 'validation', issues: [{ field: 'status', reason: 'invalid' }] });
    }
    const deps = taskDeps(db());
    const result = await listTasks(deps, scope, {
      projectId: query.get('projectId') ?? undefined,
      statuses: parsed.data,
    });
    if (!result.ok) return fail(ctx, result.error);
    const summaries = await listSummaries(deps, scope, result.value);
    return ctx.json(200, { data: summaries.map(toSummaryJson) });
  });

export const getOneTask = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await getTaskDetail(taskDeps(db()), scope, ctx.params.id ?? '');
    if (!result.ok) return fail(ctx, result.error);
    return ctx.json(200, {
      data: {
        ...toSummaryJson(result.value),
        subtasks: result.value.subtaskList.map(toSummaryJson),
      },
    });
  });

export const patchTask = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(PatchBody);
    if (!body.ok) return body.response;
    return reply(
      ctx,
      await inTransaction((deps) => updateTask(deps, scope, ctx.params.id ?? '', body.data)),
    );
  });

export const postComplete = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(CompleteBody);
    if (!body.ok) return body.response;
    return reply(
      ctx,
      await inTransaction((deps) => completeTask(deps, scope, ctx.params.id ?? '', body.data)),
    );
  });

export const postReopen = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(VersionBody);
    if (!body.ok) return body.response;
    return reply(ctx, await reopenTask(taskDeps(db()), scope, ctx.params.id ?? '', body.data));
  });

export const postMove = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(MoveBody);
    if (!body.ok) return body.response;
    return reply(
      ctx,
      await inTransaction((deps) => moveTask(deps, scope, ctx.params.id ?? '', body.data)),
    );
  });

export const postDetach = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(VersionBody);
    if (!body.ok) return body.response;
    return reply(ctx, await detachTask(taskDeps(db()), scope, ctx.params.id ?? '', body.data));
  });

/** GET /workspaces/{ws}/my-tasks — son tarihe göre gruplu (BR-INBOX-004, BR-DATE-003). */
export const getMyTasks = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const prefs = await findUserPreferences(db(), ctx.actor.userId);
    const timezone = prefs?.timezone ?? 'UTC';
    const result = await myTasks(taskDeps(db()), scope, {
      today: todayIn(timezone, new Date()),
      weekStart: prefs?.weekStart ?? 1,
    });
    if (!result.ok) return fail(ctx, result.error);
    return ctx.json(200, {
      data: result.value.map(({ group, items }) => ({ group, tasks: items.map(toSummaryJson) })),
    });
  });
