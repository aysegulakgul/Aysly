import { z } from 'zod';
import { findProjectRef } from '@/modules/projects';
import { findLiveTaskRefs, linkedTaskProgress } from '@/modules/tasks';
import { resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { db, type DbExecutor } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { idempotent } from '@/shared/http/idempotency';
import { systemClock } from '@/shared/kernel/clock';
import type { DomainError } from '@/shared/kernel/errors';
import { uuidv7 } from '@/shared/kernel/id';
import {
  createGoal,
  deleteGoal,
  getGoal,
  listGoals,
  setGoalArchived,
  setGoalLinks,
  updateGoal,
  type GoalDeps,
  type GoalWithProgress,
} from '../application/goals';
import { GOAL_STATUSES, PROGRESS_MODES, suggestAchieved, type Goal } from '../domain/goal';
import { createDrizzleGoalRepository } from '../infrastructure/drizzle-goal-repository';

export function goalDeps(executor: DbExecutor): GoalDeps {
  return {
    goals: createDrizzleGoalRepository(executor),
    tasks: {
      progress: (scope, links) => linkedTaskProgress(executor, scope, links),
      async validTasks(scope, ids) {
        return new Set((await findLiveTaskRefs(executor, scope, ids)).map((t) => t.id));
      },
      async validProjects(scope, ids) {
        const found = await Promise.all(ids.map((id) => findProjectRef(executor, scope, id)));
        return new Set(found.flatMap((p) => (p ? [p.id] : [])));
      },
    },
    clock: systemClock,
    newId: uuidv7,
  };
}

/** API hedef nesnesi (API_CONTRACTS §10): ilerleme, bağlantılar (çöpteki kayıt gizlenir, BR-GOAL-004), öneri. */
async function toGoalJson(executor: DbExecutor, scope: WorkspaceScope, items: GoalWithProgress[]) {
  const taskIds = [...new Set(items.flatMap((i) => i.links.taskIds))];
  const projectIds = [...new Set(items.flatMap((i) => i.links.projectIds))];
  const [taskRefs, projectRefs] = await Promise.all([
    findLiveTaskRefs(executor, scope, taskIds),
    Promise.all(projectIds.map((id) => findProjectRef(executor, scope, id))),
  ]);
  const taskById = new Map(taskRefs.map((t) => [t.id, t]));
  const projectById = new Map(projectRefs.flatMap((p) => (p ? [[p.id, p] as const] : [])));
  return items.map(({ goal, progress, links }) => ({
    id: goal.id,
    title: goal.title,
    description: goal.description,
    targetDate: goal.targetDate,
    status: goal.status,
    progressMode: goal.progressMode,
    manualProgress: goal.manualProgress,
    progress,
    /** BR-GOAL-003 */
    suggestAchieved: suggestAchieved(goal, progress),
    links: {
      tasks: links.taskIds.flatMap((id) => {
        const t = taskById.get(id);
        return t ? [{ id: t.id, title: t.title, status: t.status, projectId: t.projectId }] : [];
      }),
      projects: links.projectIds.flatMap((id) => {
        const p = projectById.get(id);
        return p ? [{ id: p.id, name: p.name }] : [];
      }),
    },
    achievedAt: goal.achievedAt?.toISOString() ?? null,
    archivedAt: goal.archivedAt?.toISOString() ?? null,
    deletedAt: goal.deletedAt?.toISOString() ?? null,
    version: goal.version,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  }));
}
export type GoalView = Awaited<ReturnType<typeof toGoalJson>>[number];

async function withScope(
  ctx: ApiContext,
  handle: (scope: WorkspaceScope) => Promise<Response>,
): Promise<Response> {
  const scope = await resolveWorkspaceScope(db(), ctx.actor.userId, ctx.params.ws ?? '');
  return scope ? handle(scope) : ctx.fail({ kind: 'not_found' });
}

async function one(executor: DbExecutor, scope: WorkspaceScope, id: string) {
  const result = await getGoal(goalDeps(executor), scope, id, { includeDeleted: true });
  if (!result.ok) return null;
  const [goal] = await toGoalJson(executor, scope, [result.value]);
  return goal ?? null;
}

async function fail(ctx: ApiContext, scope: WorkspaceScope, error: DomainError) {
  if (error.kind === 'version_conflict' && error.current) {
    return ctx.fail({
      kind: 'version_conflict',
      current: await one(db(), scope, (error.current as Goal).id),
    });
  }
  return ctx.fail(error);
}

const DateField = z.string().max(20).nullable();
const CreateBody = z.strictObject({
  title: z.string().max(1000),
  description: z.string().max(20_000).nullable().optional(),
  targetDate: DateField.optional(),
});
const PatchBody = z.strictObject({
  version: z.number().int().positive(),
  title: z.string().max(1000).optional(),
  description: z.string().max(20_000).nullable().optional(),
  targetDate: DateField.optional(),
  status: z.enum(GOAL_STATUSES).optional(),
  progressMode: z.enum(PROGRESS_MODES).optional(),
  manualProgress: z.number().int().nullable().optional(),
});
const Links = z.strictObject({
  taskIds: z.array(z.string().max(100)).max(100),
  projectIds: z.array(z.string().max(100)).max(100),
});

/** GET /goals?status=active|achieved|abandoned&includeArchived= */
export const getGoals = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const query = new URL(ctx.request.url).searchParams;
    const status = GOAL_STATUSES.find((s) => s === query.get('status'));
    const result = await listGoals(goalDeps(db()), scope, {
      status,
      includeArchived: query.get('includeArchived') === 'true',
      linkedTaskId: query.get('linkedTaskId') ?? undefined,
      linkedProjectId: query.get('linkedProjectId') ?? undefined,
    });
    if (!result.ok) return fail(ctx, scope, result.error);
    return ctx.json(200, { data: await toGoalJson(db(), scope, result.value) });
  });

export const postGoal = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(CreateBody);
    if (!body.ok) return body.response;
    return idempotent(ctx, body.data, async (tx) => {
      const result = await createGoal(goalDeps(tx), scope, body.data);
      if (!result.ok) {
        const failure = await fail(ctx, scope, result.error);
        return { status: failure.status, body: await failure.json() };
      }
      return { status: 201, body: { data: await one(tx, scope, result.value.id) } };
    });
  });

export const getOneGoal = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const goal = await one(db(), scope, ctx.params.id ?? '');
    if (!goal) return ctx.fail({ kind: 'not_found' });
    const includeDeleted = new URL(ctx.request.url).searchParams.get('includeDeleted') === 'true';
    if (goal.deletedAt && !includeDeleted) return ctx.fail({ kind: 'not_found' });
    return ctx.json(200, { data: goal });
  });

export const patchGoal = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(PatchBody);
    if (!body.ok) return body.response;
    const result = await updateGoal(goalDeps(db()), scope, ctx.params.id ?? '', body.data);
    if (!result.ok) return fail(ctx, scope, result.error);
    return ctx.json(200, { data: await one(db(), scope, result.value.id) });
  });

/** PUT /goals/{id}/links `{ taskIds, projectIds }` (tam küme, FR-GOAL-02). */
export const putGoalLinks = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(Links);
    if (!body.ok) return body.response;
    const result = await db().transaction((tx) =>
      setGoalLinks(goalDeps(tx), scope, ctx.params.id ?? '', body.data),
    );
    if (!result.ok) return fail(ctx, scope, result.error);
    return ctx.json(200, { data: await one(db(), scope, ctx.params.id ?? '') });
  });

const archive = (archived: boolean) => (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await setGoalArchived(goalDeps(db()), scope, ctx.params.id ?? '', archived);
    if (!result.ok) return fail(ctx, scope, result.error);
    return ctx.json(200, { data: await one(db(), scope, result.value.id) });
  });
export const postGoalArchive = archive(true);
export const postGoalUnarchive = archive(false);

export const deleteOneGoal = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await deleteGoal(goalDeps(db()), scope, ctx.params.id ?? '');
    return result.ok ? ctx.json(200, { data: result.value }) : fail(ctx, scope, result.error);
  });

/** Sunucu bileşenleri için. */
export async function findGoals(
  scope: WorkspaceScope,
  filter: {
    status?: (typeof GOAL_STATUSES)[number];
    linkedTaskId?: string;
    linkedProjectId?: string;
  } = {},
) {
  const result = await listGoals(goalDeps(db()), scope, filter);
  return result.ok ? toGoalJson(db(), scope, result.value) : [];
}
export const findGoal = (scope: WorkspaceScope, id: string) => one(db(), scope, id);
