import { z } from 'zod';
import { authorize, resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { db, type DbExecutor } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { systemClock } from '@/shared/kernel/clock';
import { deleteTag, listManagedTags, updateTag, type TagDeps } from '../application/tags';
import { TAG_COLORS } from '../domain/tag';
import {
  deleteTagRow,
  findTag,
  findTagByName,
  listTagsWithUsage,
  updateTagRow,
} from '../infrastructure/tag-store';

const PatchBody = z.strictObject({
  name: z.string().max(200).optional(),
  color: z.enum(TAG_COLORS).optional(),
});

function tagDeps(executor: DbExecutor): TagDeps {
  return {
    tags: {
      list: (scope) => listTagsWithUsage(executor, scope),
      find: (scope, id) => findTag(executor, scope, id),
      nameTakenBy: (scope, name, exceptId) => findTagByName(executor, scope, name, exceptId),
      update: (scope, id, changes, now) => updateTagRow(executor, scope, id, changes, now),
      remove: (scope, id) => deleteTagRow(executor, scope, id),
    },
    clock: systemClock,
  };
}

async function withScope(
  ctx: ApiContext,
  handle: (scope: WorkspaceScope) => Promise<Response>,
): Promise<Response> {
  const scope = await resolveWorkspaceScope(db(), ctx.actor.userId, ctx.params.ws ?? '');
  return scope ? handle(scope) : ctx.fail({ kind: 'not_found' });
}

/** GET /workspaces/{ws}/tags (API_CONTRACTS §7): ada göre sıralı, kullanım sayılarıyla. */
export const getTags = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await listManagedTags(tagDeps(db()), scope);
    return result.ok ? ctx.json(200, { data: result.value }) : ctx.fail(result.error);
  });

/** PATCH /tags/{id}: ad ve renk (BR-TAG-001). */
export const patchTag = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(PatchBody);
    if (!body.ok) return body.response;
    const result = await db().transaction((tx) =>
      updateTag(tagDeps(tx), scope, ctx.params.id ?? '', body.data),
    );
    return result.ok ? ctx.json(200, { data: result.value }) : ctx.fail(result.error);
  });

/** DELETE /tags/{id}: kalıcı (BR-TAG-002); yanıt `{ removedFrom: { tasks, notes } }`. */
export const deleteOneTag = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await db().transaction((tx) =>
      deleteTag(tagDeps(tx), scope, ctx.params.id ?? ''),
    );
    return result.ok ? ctx.json(200, { data: result.value }) : ctx.fail(result.error);
  });

/** Ayarlar · Etiketler sayfası için (sunucu bileşeni). */
export async function findManagedTags(scope: WorkspaceScope) {
  const allowed = authorize(scope, 'task.read');
  if (!allowed.ok) return [];
  return listTagsWithUsage(db(), scope);
}
