import { goalDeps } from '@/modules/goals';
import { noteDeps, displayTitle } from '@/modules/notes';
import {
  deleteTrash as deleteTaskTrash,
  findArchive,
  findTrash,
  postRestore as postTaskRestore,
  trashTiming,
} from '@/modules/tasks';
import { authorize, resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { db } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { systemClock } from '@/shared/kernel/clock';

/**
 * Arşiv ve çöp orkestrasyonu (ARCHITECTURE §4.1 `lifecycle`): görev ve proje grupları tasks modülünden, notlar ve
 * hedefler kendi modüllerinden gelir. Not ve hedef tek başına bir silme grubudur (BR-DEL-006).
 */
async function withScope(
  ctx: ApiContext,
  handle: (scope: WorkspaceScope) => Promise<Response>,
): Promise<Response> {
  const scope = await resolveWorkspaceScope(db(), ctx.actor.userId, ctx.params.ws ?? '');
  return scope ? handle(scope) : ctx.fail({ kind: 'not_found' });
}

type Owned = { kind: 'note' | 'goal'; id: string; deletedAt: Date };

/** Grup kimliği veya kayıt kimliği bir not ya da hedefe aitse onu döner. */
async function ownerOf(
  scope: WorkspaceScope,
  key: { batchId?: string; type?: string; id?: string },
) {
  const [notes, goals] = await Promise.all([
    noteDeps(db()).notes.listTrashed(scope),
    goalDeps(db()).goals.listTrashed(scope),
  ]);
  const match = (
    kind: Owned['kind'],
    items: { id: string; deletedAt: Date | null; deletedBatchId: string | null }[],
  ) =>
    items.find((x) =>
      key.batchId ? x.deletedBatchId === key.batchId : key.type === kind && x.id === key.id,
    );
  const note = match('note', notes);
  if (note) return { kind: 'note', id: note.id, deletedAt: note.deletedAt! } satisfies Owned;
  const goal = match('goal', goals);
  if (goal) return { kind: 'goal', id: goal.id, deletedAt: goal.deletedAt! } satisfies Owned;
  return null;
}

/** GET /trash: tüm türlerin silme grupları, en yeni önce (API_CONTRACTS §13). */
export const getTrash = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const allowed = authorize(scope, 'task.read');
    if (!allowed.ok) return ctx.fail(allowed.error);
    return ctx.json(200, { data: await findTrashGroups(scope) });
  });

export async function findTrashGroups(scope: WorkspaceScope) {
  const now = systemClock.now();
  const [tasks, notes, goals] = await Promise.all([
    findTrash(scope),
    noteDeps(db()).notes.listTrashed(scope),
    goalDeps(db()).goals.listTrashed(scope),
  ]);
  const own = (
    type: 'note' | 'goal',
    id: string,
    title: string,
    deletedAt: Date,
    batchId: string | null,
  ) => {
    const timing = trashTiming(deletedAt, now);
    return {
      batchId: batchId ?? id,
      deletedAt: deletedAt.toISOString(),
      purgeAt: timing.purgeAt.toISOString(),
      daysLeft: timing.daysLeft,
      expired: timing.expired,
      root: { type, id, title },
      count: 0,
    };
  };
  return [
    ...tasks,
    ...notes.map((n) => own('note', n.id, displayTitle(n, '—'), n.deletedAt!, n.deletedBatchId)),
    ...goals.map((g) => own('goal', g.id, g.title, g.deletedAt!, g.deletedBatchId)),
  ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/** POST /trash/restore: not/hedef grubu veya `{ type: 'note'|'goal', id }`; diğerleri görev ve proje akışına gider. */
export const postRestore = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const peek = (await ctx.request
      .clone()
      .json()
      .catch(() => null)) as { batchId?: string; type?: string; id?: string } | null;
    const owned = peek ? await ownerOf(scope, peek) : null;
    if (!owned) return postTaskRestore(ctx);
    const allowed = authorize(scope, owned.kind === 'note' ? 'note.delete' : 'goal.delete');
    if (!allowed.ok) return ctx.fail(allowed.error);
    // BR-DEL-003: süresi dolan kayıt geri yüklenemez.
    if (trashTiming(owned.deletedAt, systemClock.now()).expired) {
      return ctx.fail({ kind: 'business_rule', rule: 'BR-DEL-003' });
    }
    const now = systemClock.now();
    const restored =
      owned.kind === 'note'
        ? await noteDeps(db()).notes.restore(scope, owned.id, now)
        : await goalDeps(db()).goals.restore(scope, owned.id, now);
    return restored
      ? ctx.json(200, { data: { restored: 1, movedToInbox: 0 } })
      : ctx.fail({ kind: 'not_found' });
  });

/**
 * DELETE /trash/{batchId} ve DELETE /trash (BR-DEL-005, `{ confirm: true }`). Not/hedef grubu kendi modülünde
 * silinir; "Çöpü boşalt" tüm türleri siler.
 */
export const deleteTrash = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = (await ctx.request
      .clone()
      .json()
      .catch(() => null)) as { confirm?: unknown } | null;
    const batchId = ctx.params.batchId ?? null;
    if (batchId) {
      const owned = await ownerOf(scope, { batchId });
      if (owned) {
        const allowed = authorize(scope, owned.kind === 'note' ? 'note.delete' : 'goal.delete');
        if (!allowed.ok) return ctx.fail(allowed.error);
        if (body?.confirm !== true) {
          return ctx.fail({
            kind: 'validation',
            issues: [{ field: 'confirm', reason: 'required' }],
          });
        }
        const purged =
          owned.kind === 'note'
            ? await noteDeps(db()).notes.purge(scope, owned.id)
            : await goalDeps(db()).goals.purge(scope, owned.id);
        return ctx.json(200, { data: { purged } });
      }
      return deleteTaskTrash(ctx);
    }
    const response = await deleteTaskTrash(ctx);
    if (!response.ok) return response;
    const [notes, goals] = await Promise.all([
      noteDeps(db()).notes.purge(scope, null),
      goalDeps(db()).goals.purge(scope, null),
    ]);
    const { data } = (await response.json()) as { data: { purged: number } };
    return ctx.json(200, { data: { purged: data.purged + notes + goals } });
  });

/** GET /archive: arşivli projeler, görevler, notlar ve hedefler (FR-SET-06, türe göre sekmeler). */
export const getArchive = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const allowed = authorize(scope, 'task.read');
    if (!allowed.ok) return ctx.fail(allowed.error);
    return ctx.json(200, { data: await findArchiveContents(scope) });
  });

export async function findArchiveContents(scope: WorkspaceScope) {
  const [base, notes, goals] = await Promise.all([
    findArchive(scope),
    noteDeps(db()).notes.list(scope, { includeArchived: true }),
    goalDeps(db()).goals.list(scope, { includeArchived: true }),
  ]);
  return {
    ...base,
    notes: notes
      .filter((n) => n.archivedAt)
      .map((n) => ({
        id: n.id,
        title: displayTitle(n, '—'),
        archivedAt: n.archivedAt!.toISOString(),
        version: n.version,
      })),
    goals: goals
      .filter((g) => g.archivedAt)
      .map((g) => ({
        id: g.id,
        title: g.title,
        archivedAt: g.archivedAt!.toISOString(),
        version: g.version,
      })),
  };
}
export type ArchiveContentsView = Awaited<ReturnType<typeof findArchiveContents>>;
export type TrashGroupsView = Awaited<ReturnType<typeof findTrashGroups>>;
