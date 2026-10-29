import { z } from 'zod';
import { findUserPreferences } from '@/modules/preferences';
import {
  PROJECT_STATUSES,
  createDrizzleProjectRepository,
  findAnyProject,
  findInboxRef,
  findProjectRef,
  listActiveProjects,
  listTrashedProjects,
  purgeProjects,
  restoreProjects,
  toProjectJson,
  trashProject,
  type Project,
} from '@/modules/projects';
import {
  countTags,
  existingTagIds,
  findTagsForTasks,
  missingTagNames,
  replaceTaskTags,
  taskIdsWithTags,
} from '@/modules/tags';
import { VIEW_TYPES, parseTaskFilter } from '@/modules/views';
import { createNotificationStore } from '@/modules/notifications';
import {
  cancelPendingReminders,
  deleteRelativeReminders,
  deleteReminder,
  findDueReminders,
  findRemindersForTasks,
  insertReminder,
  reactivateReminders,
  transitionReminder,
  updateReminderTime,
  type Reminder,
} from '@/modules/reminders';
import { RECURRENCE_MODES } from '../domain/recurrence';
import { addReminder, dispatchDueReminders, removeReminder } from '../application/reminders';
import { resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { db, type Database, type DbExecutor } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { idempotent } from '@/shared/http/idempotency';
import { systemClock, type Clock } from '@/shared/kernel/clock';
import type { DomainError } from '@/shared/kernel/errors';
import { uuidv7 } from '@/shared/kernel/id';
import type { Result } from '@/shared/kernel/result';
import { BULK_LIMIT, bulkTasks } from '../application/bulk';
import {
  archiveContents,
  completeProject,
  deleteProject,
  projectDeletePreview,
  projectDetail,
  projectOverview,
} from '../application/projects';
import { queryTasks } from '../application/query';
import {
  detachTask,
  getTaskDetail,
  moveTask,
  myTasks,
  type TaskSummary,
} from '../application/organize';
import {
  completeTask,
  createTask,
  reopenTask,
  updateTask,
  type TaskDeps,
} from '../application/tasks';
import {
  archiveTask,
  deleteTask,
  listTrash,
  purgeTrash,
  restoreFromTrash,
  unarchiveTask,
} from '../application/lifecycle';
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
const RecurrenceBody = z.strictObject({
  rule: z.string().min(1).max(300),
  mode: z.enum(RECURRENCE_MODES).optional(),
});
/** API_CONTRACTS §8: mutlak (ISO an) veya göreli (son tarihe göre dakika). */
const ReminderBody = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('absolute'), remindAt: z.string().max(40) }),
  z.strictObject({ kind: z.literal('relative'), offsetMinutes: z.number().int() }),
]);
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
  recurrence: RecurrenceBody.nullable().optional(),
  reminders: z.array(ReminderBody).max(5).optional(),
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
  recurrence: RecurrenceBody.nullable().optional(),
  recurrenceScope: z.enum(['this', 'following']).optional(),
});
const VersionBody = z.strictObject({ version: z.number().int().positive() });
const CompleteBody = z.strictObject({
  version: z.number().int().positive(),
  completeSubtasks: z.boolean().optional(),
});
const MoveBody = z.strictObject({
  version: z.number().int().positive(),
  projectId: z.string().max(100).optional(),
  beforeId: z.string().max(100).optional(),
  afterId: z.string().max(100).optional(),
});
const TaskIds = z.array(z.string().max(100)).min(1).max(BULK_LIMIT);
/** API_CONTRACTS §6.6, D-084. */
const BulkBody = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('complete'), taskIds: TaskIds }),
  z.strictObject({ action: z.literal('reopen'), taskIds: TaskIds }),
  z.strictObject({ action: z.literal('archive'), taskIds: TaskIds }),
  z.strictObject({ action: z.literal('delete'), taskIds: TaskIds }),
  z.strictObject({
    action: z.literal('move'),
    taskIds: TaskIds,
    params: z.strictObject({ projectId: z.string().max(100) }),
  }),
  z.strictObject({
    action: z.literal('setStatus'),
    taskIds: TaskIds,
    params: z.strictObject({ status: z.enum(['todo', 'in_progress']) }),
  }),
  z.strictObject({
    action: z.literal('setDue'),
    taskIds: TaskIds,
    params: z.strictObject({ due: Due.nullable() }),
  }),
  z.strictObject({
    action: z.literal('setPriority'),
    taskIds: TaskIds,
    params: z.strictObject({ priority: Priority }),
  }),
  z.strictObject({
    action: z.literal('addTags'),
    taskIds: TaskIds,
    params: z.strictObject({ tagNames: TagNames.min(1) }),
  }),
  z.strictObject({
    action: z.literal('removeTags'),
    taskIds: TaskIds,
    params: z.strictObject({ tagNames: TagNames.min(1) }),
  }),
]);

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
    recurrence: task.recurrence
      ? {
          rule: task.recurrence.rule,
          mode: task.recurrence.mode,
          seriesId: task.recurrence.seriesId,
          index: task.recurrence.index,
        }
      : null,
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

export function toReminderJson(r: Reminder) {
  return {
    id: r.id,
    kind: r.kind,
    offsetMinutes: r.offsetMinutes,
    remindAt: r.remindAt.toISOString(),
    status: r.status,
  };
}

export function taskDeps(executor: DbExecutor): TaskDeps {
  return {
    reminders: {
      forTasks: (scope, ids) => findRemindersForTasks(executor, scope, ids),
      insert: (scope, r) => insertReminder(executor, scope, r),
      remove: (scope, taskId, id) => deleteReminder(executor, scope, taskId, id),
      retime: (scope, id, at, status, now) =>
        updateReminderTime(executor, scope, id, at, status, now),
      removeRelative: (scope, taskId) => deleteRelativeReminders(executor, scope, taskId),
      cancel: (scope, ids, now) => cancelPendingReminders(executor, scope, ids, now),
      reactivate: (scope, ids, now) => reactivateReminders(executor, scope, ids, now),
    },
    calendar: {
      async of(userId) {
        const prefs = await findUserPreferences(executor, userId);
        return {
          timezone: prefs?.timezone ?? 'UTC',
          allDayReminderTime: prefs?.allDayReminderTime ?? '09:00',
          weekStart: prefs?.weekStart ?? 1,
        };
      },
    },
    tasks: createDrizzleTaskRepository(executor),
    projects: {
      find: (scope, id) => findProjectRef(executor, scope, id),
      inbox: (scope) => findInboxRef(executor, scope),
      listActive: (scope) => listActiveProjects(executor, scope),
      repo: createDrizzleProjectRepository(executor),
      findAny: (scope, id) => findAnyProject(executor, scope, id),
      trash: (scope, id, batchId, now) => trashProject(executor, scope, id, batchId, now),
      restore: (scope, ids, now) => restoreProjects(executor, scope, ids, now),
      listTrashed: (scope, batchId) => listTrashedProjects(executor, scope, batchId),
      purge: (scope, batchId) => purgeProjects(executor, scope, batchId),
    },
    tags: {
      replace: (scope, taskId, names, now) => replaceTaskTags(executor, scope, taskId, names, now),
      forTasks: (scope, ids) => findTagsForTasks(executor, scope, ids),
      missing: (scope, names) => missingTagNames(executor, scope, names),
      count: (scope) => countTags(executor, scope),
      existing: (scope, ids) => existingTagIds(executor, scope, ids),
      taskIdsWithTags: (scope, ids, mode) => taskIdsWithTags(executor, scope, ids, mode),
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

/** Kullanıcının bugünü ve hafta başlangıcı (BR-DATE-003): görünüm filtrelerindeki tarih koşulları için. */
async function userCalendar(userId: string) {
  const prefs = await findUserPreferences(db(), userId);
  return { today: todayIn(prefs?.timezone ?? 'UTC', new Date()), weekStart: prefs?.weekStart ?? 1 };
}

/**
 * GET /tasks (API_CONTRACTS §6.2): `TaskFilter` v1 sorgu parametreleri, `sort`, `view=list|board`. Yanıtta
 * `meta.ignored`: artık var olmayan proje/etiket koşulları (BR-VIEW-001).
 */
export const getTasks = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const query = new URL(ctx.request.url).searchParams;
    const { filter, settings } = parseTaskFilter(query);
    const viewType = z
      .enum(VIEW_TYPES)
      .catch('list')
      .parse(query.get('view') ?? 'list');
    if (!filter.success || !settings.success) {
      const issues = [...(filter.error?.issues ?? []), ...(settings.error?.issues ?? [])];
      return ctx.fail({
        kind: 'validation',
        issues: issues.map((i) => ({ field: String(i.path[0] ?? 'filter'), reason: 'invalid' })),
      });
    }
    const result = await queryTasks(taskDeps(db()), scope, filter.data, settings.data, {
      ...(await userCalendar(ctx.actor.userId)),
      viewType,
    });
    if (!result.ok) return fail(ctx, result.error);
    return ctx.json(200, {
      data: result.value.items.map(toSummaryJson),
      meta: { ignored: result.value.ignored },
    });
  });

export const getOneTask = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const includeDeleted = new URL(ctx.request.url).searchParams.get('includeDeleted') === 'true';
    const result = await getTaskDetail(taskDeps(db()), scope, ctx.params.id ?? '', {
      includeDeleted,
    });
    if (!result.ok) return fail(ctx, result.error);
    const reminders = await findRemindersForTasks(db(), scope, [result.value.task.id]);
    return ctx.json(200, {
      data: {
        ...toSummaryJson(result.value),
        subtasks: result.value.subtaskList.map(toSummaryJson),
        reminders: (reminders.get(result.value.task.id) ?? []).map(toReminderJson),
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
    const result = await inTransaction((deps) =>
      completeTask(deps, scope, ctx.params.id ?? '', body.data),
    );
    if (!result.ok) return fail(ctx, result.error);
    // API_CONTRACTS §6.5: tekrarlayan görevde üretilen sonraki örnek (BR-REC-002).
    const next = result.value.nextOccurrence;
    return ctx.json(200, {
      data: { ...toTaskJson(result.value), nextOccurrence: next ? toTaskJson(next) : null },
    });
  });

export const postReopen = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(VersionBody);
    if (!body.ok) return body.response;
    const result = await inTransaction((deps) =>
      reopenTask(deps, scope, ctx.params.id ?? '', body.data),
    );
    if (!result.ok) return fail(ctx, result.error);
    // BR-REC-007: üretilmiş sonraki örnek değiştirildiği için korunduysa kullanıcı bilgilendirilir.
    return ctx.json(200, {
      data: { ...toTaskJson(result.value), keptNextOccurrence: !!result.value.keptNextOccurrence },
    });
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

const ConfirmBody = z.strictObject({ confirm: z.literal(true) });
const ProjectChoice = z.enum(['restore', 'inbox']);
const RestoreBody = z.union([
  z.strictObject({ batchId: z.string().max(100), projectChoice: ProjectChoice.optional() }),
  z.strictObject({ type: z.literal('project'), id: z.string().max(100) }),
  z.strictObject({
    type: z.literal('task').optional(),
    id: z.string().max(100),
    restoreParent: z.boolean().optional(),
    projectChoice: ProjectChoice.optional(),
  }),
]);

export const postArchive = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(VersionBody);
    if (!body.ok) return body.response;
    return reply(
      ctx,
      await inTransaction((deps) => archiveTask(deps, scope, ctx.params.id ?? '', body.data)),
    );
  });

export const postUnarchive = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(VersionBody);
    if (!body.ok) return body.response;
    return reply(
      ctx,
      await inTransaction((deps) => unarchiveTask(deps, scope, ctx.params.id ?? '', body.data)),
    );
  });

/** DELETE /tasks/{id}: çöpe taşır (BR-DEL-001/006); yanıt `{ batchId, affected }`. */
export const deleteOneTask = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const recurrenceScope = new URL(ctx.request.url).searchParams.get('scope');
    if (recurrenceScope !== null && recurrenceScope !== 'this' && recurrenceScope !== 'series') {
      return ctx.fail({ kind: 'validation', issues: [{ field: 'scope', reason: 'invalid' }] });
    }
    const result = await inTransaction((deps) =>
      deleteTask(deps, scope, ctx.params.id ?? '', undefined, {
        recurrenceScope: recurrenceScope ?? undefined,
      }),
    );
    return result.ok ? ctx.json(200, { data: result.value }) : fail(ctx, result.error);
  });

/** GET /trash: silme grupları (API_CONTRACTS §13). */
export const getTrash = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await listTrash(taskDeps(db()), scope);
    if (!result.ok) return fail(ctx, result.error);
    return ctx.json(200, {
      data: result.value.map((g) => ({
        ...g,
        deletedAt: g.deletedAt.toISOString(),
        purgeAt: g.purgeAt.toISOString(),
      })),
    });
  });

/** POST /trash/restore: `{ batchId }` veya `{ id, restoreParent? }` (BR-DEL-004, BR-SUB-004). */
export const postRestore = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(RestoreBody);
    if (!body.ok) return body.response;
    const result = await inTransaction((deps) => restoreFromTrash(deps, scope, body.data));
    return result.ok ? ctx.json(200, { data: result.value }) : fail(ctx, result.error);
  });

/** DELETE /trash (çöpü boşalt) ve DELETE /trash/{batchId}: kalıcı silme, `{ confirm: true }` zorunlu (BR-DEL-005). */
export const deleteTrash = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(ConfirmBody);
    if (!body.ok) return body.response;
    const result = await purgeTrash(taskDeps(db()), scope, {
      batchId: ctx.params.batchId ?? null,
      confirm: body.data.confirm,
    });
    return result.ok ? ctx.json(200, { data: result.value }) : fail(ctx, result.error);
  });

/** POST /tasks/bulk (BR-TASK-008, D-084): atomik; bir görev reddedilirse işlem geri alınır, hiçbiri uygulanmaz. */
class BulkRollback extends Error {
  constructor(readonly error: DomainError) {
    super('toplu işlem geri alındı');
  }
}
export const postBulk = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(BulkBody);
    if (!body.ok) return body.response;
    const { action, taskIds } = body.data;
    const params = 'params' in body.data ? body.data.params : {};
    try {
      const value = await db().transaction(async (tx) => {
        const result = await bulkTasks(taskDeps(tx), scope, {
          action,
          taskIds,
          ...params,
        } as Parameters<typeof bulkTasks>[2]);
        if (!result.ok) throw new BulkRollback(result.error);
        return result.value;
      });
      return ctx.json(200, { data: value });
    } catch (error) {
      if (error instanceof BulkRollback) return fail(ctx, error.error);
      throw error;
    }
  });

const ProjectQuery = z.object({
  status: z.array(z.enum(PROJECT_STATUSES)).max(3),
  includeArchived: z.boolean(),
});

/** Proje okuma ve silme uç noktalarının sürüm çakışması: güncel proje API biçiminde döner. */
function failProject(ctx: ApiContext, error: DomainError) {
  return error.kind === 'version_conflict' && error.current
    ? ctx.fail({ kind: 'version_conflict', current: toProjectJson(error.current as Project) })
    : ctx.fail(error);
}

/** GET /projects (API_CONTRACTS §5): Inbox ilk (`kind: 'inbox'`), sonra standart projeler ilerlemeyle. */
export const getProjects = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const query = new URL(ctx.request.url).searchParams;
    const parsed = ProjectQuery.safeParse({
      status: query
        .getAll('status')
        .flatMap((v) => v.split(','))
        .filter(Boolean),
      includeArchived: query.get('includeArchived') === 'true',
    });
    if (!parsed.success) {
      return ctx.fail({ kind: 'validation', issues: [{ field: 'status', reason: 'invalid' }] });
    }
    const deps = taskDeps(db());
    const result = await projectOverview(deps, scope, {
      statuses: parsed.data.status,
      includeArchived: parsed.data.includeArchived,
    });
    if (!result.ok) return failProject(ctx, result.error);
    const inbox = await deps.projects.repo.findById(scope, (await deps.projects.inbox(scope)).id);
    return ctx.json(200, {
      data: [
        ...(inbox ? [toProjectJson(inbox)] : []),
        ...result.value.map((p) => toProjectJson(p.project, p.progress)),
      ],
    });
  });

/** GET /projects/{id} (BR-DEL-007: `?includeDeleted=true` ile çöpteki proje). */
export const getOneProject = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const includeDeleted = new URL(ctx.request.url).searchParams.get('includeDeleted') === 'true';
    const result = await projectDetail(taskDeps(db()), scope, ctx.params.id ?? '', {
      includeDeleted,
    });
    return result.ok
      ? ctx.json(200, { data: toProjectJson(result.value.project, result.value.progress) })
      : failProject(ctx, result.error);
  });

export const getProjectDeletePreview = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await projectDeletePreview(taskDeps(db()), scope, ctx.params.id ?? '');
    return result.ok ? ctx.json(200, { data: result.value }) : failProject(ctx, result.error);
  });

/** DELETE /projects/{id} (BR-PROJ-005, D-031): yanıt `{ batchId, affected: { tasks } }`. */
export const deleteOneProject = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await inTransaction((deps) => deleteProject(deps, scope, ctx.params.id ?? ''));
    return result.ok ? ctx.json(200, { data: result.value }) : failProject(ctx, result.error);
  });

const CompleteProjectBody = z.strictObject({
  version: z.number().int().positive(),
  completeOpenTasks: z.boolean(),
});

/** POST /projects/{id}/complete `{ version, completeOpenTasks }` (BR-PROJ-002). */
export const postProjectComplete = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(CompleteProjectBody);
    if (!body.ok) return body.response;
    const result = await inTransaction((deps) =>
      completeProject(deps, scope, ctx.params.id ?? '', body.data),
    );
    if (!result.ok) return failProject(ctx, result.error);
    return ctx.json(200, {
      data: {
        ...toProjectJson(result.value.project),
        completedTasks: result.value.completedTasks,
      },
    });
  });

/** GET /archive (API_CONTRACTS §13, FR-SET-06): arşivli projeler ve tek başına arşivlenmiş görevler. */
export const getArchive = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await archiveContents(taskDeps(db()), scope);
    if (!result.ok) return fail(ctx, result.error);
    return ctx.json(200, {
      data: {
        projects: result.value.projects.map((p) => toProjectJson(p.project, p.progress)),
        tasks: result.value.tasks.map(({ task, project }) => ({ ...toTaskJson(task), project })),
      },
    });
  });

/** POST /tasks/{id}/reminders (API_CONTRACTS §8, BR-REM-001/002). */
export const postReminder = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(ReminderBody);
    if (!body.ok) return body.response;
    const result = await inTransaction((deps) =>
      addReminder(deps, scope, ctx.params.id ?? '', body.data),
    );
    return result.ok
      ? ctx.json(201, { data: toReminderJson(result.value) })
      : fail(ctx, result.error);
  });

export const deleteOneReminder = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await removeReminder(
      taskDeps(db()),
      scope,
      ctx.params.id ?? '',
      ctx.params.reminderId ?? '',
    );
    return result.ok ? new Response(null, { status: 204 }) : fail(ctx, result.error);
  });

/**
 * BR-REM-005 / D-053: bildirim uç noktaları okunmadan önce aktörün zamanı gelmiş hatırlatıcıları bildirime
 * dönüştürülür (uygulama açıkken ~60 sn'lik yoklamayla). Tek veritabanı işleminde çalışır.
 */
export async function dispatchRemindersFor(
  userId: string,
  database: Database = db(),
  clock: Clock = systemClock,
): Promise<void> {
  const prefs = await findUserPreferences(database, userId);
  await database.transaction(async (tx) => {
    const deps = taskDeps(tx);
    const store = createNotificationStore(tx);
    await dispatchDueReminders(
      {
        clock,
        newId: uuidv7,
        enabled: prefs?.notificationSettings.reminder.inApp !== false,
        due: (user, now) => findDueReminders(tx, user, now),
        transition: (id, status, now) => transitionReminder(tx, id, status, now),
        async task(workspaceId, taskId) {
          const scope = await resolveWorkspaceScope(tx, userId, workspaceId);
          if (!scope) return null;
          const task = await deps.tasks.findById(scope, taskId);
          if (!task) return null;
          const project = await deps.projects.find(scope, task.projectId);
          return {
            title: task.title,
            active: task.status !== 'done' && !task.archivedAt && !!project && !project.archived,
          };
        },
        notify: (n) =>
          store.create({
            id: n.id,
            userId: n.userId,
            workspaceId: n.workspaceId,
            type: 'reminder',
            entityType: 'task',
            entityId: n.taskId,
            payload: {
              taskId: n.taskId,
              title: n.title,
              remindAt: n.remindAt.toISOString(),
              late: n.late,
            },
            dedupeKey: `reminder:${n.reminderId}`,
            now: n.now,
          }),
      },
      userId,
    );
  });
}
