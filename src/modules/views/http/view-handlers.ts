import { z } from 'zod';
import { resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { db, type DbExecutor } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { idempotent } from '@/shared/http/idempotency';
import { systemClock } from '@/shared/kernel/clock';
import type { DomainError } from '@/shared/kernel/errors';
import { uuidv7 } from '@/shared/kernel/id';
import type { Result } from '@/shared/kernel/result';
import {
  createView,
  deleteView,
  getView,
  listViews,
  updateView,
  type SavedView,
  type ViewDeps,
} from '../application/views';
import { GROUP_KEYS, SORT_KEYS, TaskFilterSchema, VIEW_TYPES } from '../domain/task-filter';
import { createDrizzleViewRepository } from '../infrastructure/drizzle-view-repository';

/** API_CONTRACTS §11: `{ name, viewType, filter (TaskFilter v1), sort, groupBy }`. */
const CreateBody = z.strictObject({
  name: z.string().max(1000),
  viewType: z.enum(VIEW_TYPES),
  filter: TaskFilterSchema,
  sort: z.enum(SORT_KEYS).default('manual'),
  groupBy: z.enum(GROUP_KEYS).default('none'),
});
const PatchBody = z.strictObject({
  version: z.number().int().positive(),
  name: z.string().max(1000).optional(),
  viewType: z.enum(VIEW_TYPES).optional(),
  filter: TaskFilterSchema.optional(),
  sort: z.enum(SORT_KEYS).optional(),
  groupBy: z.enum(GROUP_KEYS).optional(),
});

export function toViewJson(view: SavedView) {
  return {
    id: view.id,
    name: view.name,
    viewType: view.viewType,
    filter: view.filter,
    sort: view.sort,
    groupBy: view.groupBy,
    position: view.position,
    version: view.version,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}

export function viewDeps(executor: DbExecutor): ViewDeps {
  return { views: createDrizzleViewRepository(executor), clock: systemClock, newId: uuidv7 };
}

function fail(ctx: ApiContext, error: DomainError) {
  return ctx.fail(
    error.kind === 'version_conflict' && error.current
      ? { kind: 'version_conflict', current: toViewJson(error.current as SavedView) }
      : error,
  );
}

const reply = (ctx: ApiContext, result: Result<SavedView, DomainError>) =>
  result.ok ? ctx.json(200, { data: toViewJson(result.value) }) : fail(ctx, result.error);

async function withScope(
  ctx: ApiContext,
  handle: (scope: WorkspaceScope) => Promise<Response>,
): Promise<Response> {
  const scope = await resolveWorkspaceScope(db(), ctx.actor.userId, ctx.params.ws ?? '');
  return scope ? handle(scope) : ctx.fail({ kind: 'not_found' });
}

export const getViews = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await listViews(viewDeps(db()), scope);
    return result.ok
      ? ctx.json(200, { data: result.value.map(toViewJson) })
      : fail(ctx, result.error);
  });

export const getOneView = (ctx: ApiContext) =>
  withScope(ctx, async (scope) =>
    reply(ctx, await getView(viewDeps(db()), scope, ctx.params.id ?? '')),
  );

export const postView = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(CreateBody);
    if (!body.ok) return body.response;
    return idempotent(ctx, body.data, async (tx) => {
      const result = await createView(viewDeps(tx), scope, body.data);
      if (result.ok) return { status: 201, body: { data: toViewJson(result.value) } };
      const failure = fail(ctx, result.error);
      return { status: failure.status, body: await failure.json() };
    });
  });

export const patchView = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(PatchBody);
    if (!body.ok) return body.response;
    return reply(ctx, await updateView(viewDeps(db()), scope, ctx.params.id ?? '', body.data));
  });

export const deleteOneView = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await deleteView(viewDeps(db()), scope, ctx.params.id ?? '');
    return result.ok ? new Response(null, { status: 204 }) : fail(ctx, result.error);
  });

/** Sunucu bileşenleri için: kenar çubuğu ve görünüm sayfası. */
export async function findViews(scope: WorkspaceScope) {
  const result = await listViews(viewDeps(db()), scope);
  return result.ok ? result.value : [];
}

export async function findView(scope: WorkspaceScope, id: string) {
  const result = await getView(viewDeps(db()), scope, id);
  return result.ok ? result.value : null;
}
