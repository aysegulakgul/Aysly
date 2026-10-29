import { z } from 'zod';
import { authorize, resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { db, type DbExecutor } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { idempotent } from '@/shared/http/idempotency';
import { systemClock } from '@/shared/kernel/clock';
import type { DomainError } from '@/shared/kernel/errors';
import { uuidv7 } from '@/shared/kernel/id';
import type { Result } from '@/shared/kernel/result';
import {
  archiveProject,
  createProject,
  reorderProject,
  unarchiveProject,
  updateProject,
  type ProjectDeps,
} from '../application/projects';
import { PROJECT_COLORS, PROJECT_STATUSES, type Progress, type Project } from '../domain/project';
import { createDrizzleProjectRepository } from '../infrastructure/drizzle-project-repository';
import { listActiveProjects } from '../infrastructure/project-reader';

/** API_CONTRACTS §5. Gövdeler katıdır (§2.6); simge MVP'de seçilmez (D-082). */
const CreateBody = z.strictObject({
  name: z.string().max(1000),
  description: z.string().max(20_000).nullable().optional(),
  color: z.enum(PROJECT_COLORS).optional(),
});
const PatchBody = z.strictObject({
  version: z.number().int().positive(),
  name: z.string().max(1000).optional(),
  description: z.string().max(20_000).nullable().optional(),
  color: z.enum(PROJECT_COLORS).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});
const VersionBody = z.strictObject({ version: z.number().int().positive() });
const ReorderBody = z.strictObject({
  id: z.string().max(100),
  beforeId: z.string().max(100).optional(),
  afterId: z.string().max(100).optional(),
});

/** API proje nesnesi (API_CONTRACTS §5). `progress` yalnızca okuma uç noktalarında (BR-PROJ-003). */
export function toProjectJson(project: Project, progress?: Progress) {
  return {
    id: project.id,
    kind: project.kind,
    name: project.name,
    description: project.description,
    color: project.color,
    icon: null,
    status: project.status,
    position: project.position,
    ...(progress ? { progress } : {}),
    archivedAt: project.archivedAt?.toISOString() ?? null,
    deletedAt: project.deletedAt?.toISOString() ?? null,
    version: project.version,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export function projectDeps(executor: DbExecutor): ProjectDeps {
  return {
    projects: createDrizzleProjectRepository(executor),
    clock: systemClock,
    newId: uuidv7,
  };
}

function fail(ctx: ApiContext, error: DomainError) {
  return ctx.fail(
    error.kind === 'version_conflict' && error.current
      ? { kind: 'version_conflict', current: toProjectJson(error.current as Project) }
      : error,
  );
}

const reply = (ctx: ApiContext, result: Result<Project, DomainError>) =>
  result.ok ? ctx.json(200, { data: toProjectJson(result.value) }) : fail(ctx, result.error);

/** Çalışma alanı üyeliği yoksa 404 (BR-PERM-001). */
async function withScope(
  ctx: ApiContext,
  handle: (scope: WorkspaceScope) => Promise<Response>,
): Promise<Response> {
  const scope = await resolveWorkspaceScope(db(), ctx.actor.userId, ctx.params.ws ?? '');
  return scope ? handle(scope) : ctx.fail({ kind: 'not_found' });
}

/** POST /projects (BR-PROJ-001); `Idempotency-Key` ile çift gönderimde tek proje (BR-TASK-007 ile aynı yöntem). */
export const postProject = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(CreateBody);
    if (!body.ok) return body.response;
    return idempotent(ctx, body.data, async (tx) => {
      const result = await createProject(projectDeps(tx), scope, body.data);
      if (result.ok) return { status: 201, body: { data: toProjectJson(result.value) } };
      const failure = fail(ctx, result.error);
      return { status: failure.status, body: await failure.json() };
    });
  });

export const patchProject = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(PatchBody);
    if (!body.ok) return body.response;
    return reply(
      ctx,
      await updateProject(projectDeps(db()), scope, ctx.params.id ?? '', body.data),
    );
  });

export const postProjectArchive = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(VersionBody);
    if (!body.ok) return body.response;
    return reply(
      ctx,
      await archiveProject(projectDeps(db()), scope, ctx.params.id ?? '', body.data),
    );
  });

export const postProjectUnarchive = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(VersionBody);
    if (!body.ok) return body.response;
    return reply(
      ctx,
      await unarchiveProject(projectDeps(db()), scope, ctx.params.id ?? '', body.data),
    );
  });

/** POST /projects/reorder `{ id, beforeId?, afterId? }`: `afterId` projesinin ardına, `beforeId` projesinin önüne. */
export const postProjectReorder = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(ReorderBody);
    if (!body.ok) return body.response;
    return reply(ctx, await reorderProject(projectDeps(db()), scope, body.data));
  });

/** Sunucu bileşenleri için etkin projeler (taşıma ve seçim listeleri). */
export async function findActiveProjects(scope: WorkspaceScope) {
  const allowed = authorize(scope, 'project.read');
  if (!allowed.ok) return [];
  return (await listActiveProjects(db(), scope)).map(({ id, name, kind, color }) => ({
    id,
    name,
    kind,
    color,
  }));
}
