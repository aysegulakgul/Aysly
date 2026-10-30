import { z } from 'zod';
import { findProjectRef } from '@/modules/projects';
import { findTagsForNotes, noteIdsWithTag, replaceNoteTags } from '@/modules/tags';
import { findLiveTaskRefs } from '@/modules/tasks';
import { resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { db, type DbExecutor } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { idempotent } from '@/shared/http/idempotency';
import { systemClock } from '@/shared/kernel/clock';
import type { DomainError } from '@/shared/kernel/errors';
import { uuidv7 } from '@/shared/kernel/id';
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  setNoteFlags,
  setNoteLinks,
  updateNote,
  type NoteDeps,
} from '../application/notes';
import { BODY_MAX, displayTitle, preview, type Note } from '../domain/note';
import { createDrizzleNoteRepository } from '../infrastructure/drizzle-note-repository';

export function noteDeps(executor: DbExecutor): NoteDeps {
  return {
    notes: createDrizzleNoteRepository(executor, (scope, tagId) =>
      noteIdsWithTag(executor, scope, tagId),
    ),
    tags: {
      replace: (scope, noteId, names) =>
        replaceNoteTags(executor, scope, noteId, names, systemClock.now()),
    },
    targets: {
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

/**
 * API not nesnesi (API_CONTRACTS §9): etiketler ve bağlantılar (çöpteki göreve/projeye bağlantı gizlenir,
 * BR-NOTE-003). `displayTitle` başlık boşsa gövdeden türetilir (FR-NOTE-01).
 */
async function toNoteJson(
  executor: DbExecutor,
  scope: WorkspaceScope,
  items: Note[],
  fallback = '',
) {
  const ids = items.map((n) => n.id);
  const deps = noteDeps(executor);
  const [tags, links] = await Promise.all([
    findTagsForNotes(executor, scope, ids),
    deps.notes.links(scope, ids),
  ]);
  const taskIds = [...new Set([...links.values()].flatMap((l) => l.taskIds))];
  const projectIds = [...new Set([...links.values()].flatMap((l) => l.projectIds))];
  const [taskRefs, projectRefs] = await Promise.all([
    findLiveTaskRefs(executor, scope, taskIds),
    Promise.all(projectIds.map((id) => findProjectRef(executor, scope, id))),
  ]);
  const taskById = new Map(taskRefs.map((t) => [t.id, t]));
  const projectById = new Map(projectRefs.flatMap((p) => (p ? [[p.id, p] as const] : [])));
  return items.map((note) => {
    const l = links.get(note.id) ?? { taskIds: [], projectIds: [] };
    return {
      id: note.id,
      title: note.title,
      displayTitle: displayTitle(note, fallback),
      preview: preview(note),
      body: note.body,
      pinned: note.pinnedAt !== null,
      tags: tags.get(note.id) ?? [],
      links: {
        tasks: l.taskIds.flatMap((id) => {
          const t = taskById.get(id);
          return t ? [{ id: t.id, title: t.title, status: t.status }] : [];
        }),
        projects: l.projectIds.flatMap((id) => {
          const p = projectById.get(id);
          return p ? [{ id: p.id, name: p.name, kind: p.kind }] : [];
        }),
      },
      archivedAt: note.archivedAt?.toISOString() ?? null,
      deletedAt: note.deletedAt?.toISOString() ?? null,
      version: note.version,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  });
}
export type NoteView = Awaited<ReturnType<typeof toNoteJson>>[number];

async function withScope(
  ctx: ApiContext,
  handle: (scope: WorkspaceScope) => Promise<Response>,
): Promise<Response> {
  const scope = await resolveWorkspaceScope(db(), ctx.actor.userId, ctx.params.ws ?? '');
  return scope ? handle(scope) : ctx.fail({ kind: 'not_found' });
}

async function fail(ctx: ApiContext, scope: WorkspaceScope, error: DomainError) {
  if (error.kind === 'version_conflict' && error.current) {
    const [current] = await toNoteJson(db(), scope, [error.current as Note]);
    return ctx.fail({ kind: 'version_conflict', current });
  }
  return ctx.fail(error);
}

const TagNamesSchema = z.array(z.string().max(200)).max(100);
const Links = z.strictObject({
  taskIds: z.array(z.string().max(100)).max(50),
  projectIds: z.array(z.string().max(100)).max(50),
});
const CreateBody = z.strictObject({
  title: z.string().max(1000).nullable().optional(),
  body: z
    .string()
    .max(BODY_MAX + 1000)
    .optional(),
  tagNames: TagNamesSchema.optional(),
  links: Links.optional(),
});
const PatchBody = z.strictObject({
  version: z.number().int().positive(),
  title: z.string().max(1000).nullable().optional(),
  body: z
    .string()
    .max(BODY_MAX + 1000)
    .optional(),
  tagNames: TagNamesSchema.optional(),
  pinned: z.boolean().optional(),
  /** BR-NOTE-002: çatışma kopyasının başlık eki (istemci kendi dili ve saat diliminde üretir). */
  conflictLabel: z.string().max(100).optional(),
});

/** GET /notes?q=&tagId=&linkedTaskId=&linkedProjectId=&includeArchived= */
export const getNotes = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const query = new URL(ctx.request.url).searchParams;
    const result = await listNotes(noteDeps(db()), scope, {
      q: query.get('q') ?? undefined,
      tagId: query.get('tagId') ?? undefined,
      linkedTaskId: query.get('linkedTaskId') ?? undefined,
      linkedProjectId: query.get('linkedProjectId') ?? undefined,
      includeArchived: query.get('includeArchived') === 'true',
    });
    if (!result.ok) return fail(ctx, scope, result.error);
    return ctx.json(200, { data: await toNoteJson(db(), scope, result.value) });
  });

/** POST /notes (BR-NOTE-004: boş not oluşturulmaz; `Idempotency-Key`). */
export const postNote = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(CreateBody);
    if (!body.ok) return body.response;
    return idempotent(ctx, body.data, async (tx) => {
      const result = await createNote(noteDeps(tx), scope, body.data);
      if (!result.ok) {
        const failure = await fail(ctx, scope, result.error);
        return { status: failure.status, body: await failure.json() };
      }
      const [note] = await toNoteJson(tx, scope, [result.value]);
      return { status: 201, body: { data: note } };
    });
  });

/** GET /notes/{id} (BR-DEL-007: `?includeDeleted=true` ile çöpteki not). */
export const getOneNote = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const includeDeleted = new URL(ctx.request.url).searchParams.get('includeDeleted') === 'true';
    const result = await getNote(noteDeps(db()), scope, ctx.params.id ?? '', { includeDeleted });
    if (!result.ok) return fail(ctx, scope, result.error);
    const [note] = await toNoteJson(db(), scope, [result.value]);
    return ctx.json(200, { data: note });
  });

/**
 * PATCH /notes/{id}: otomatik kayıt (BR-NOTE-001/002/004). Yanıt `meta.outcome`: `saved` | `deleted` (boş bırakılan
 * not kalıcı silindi) | `conflict_copy` (kullanıcının sürümü yeni not olarak kaydedildi; `data` kopya,
 * `meta.current` sunucudaki güncel not).
 */
export const patchNote = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(PatchBody);
    if (!body.ok) return body.response;
    const { pinned, conflictLabel, ...content } = body.data;
    const id = ctx.params.id ?? '';
    return db().transaction(async (tx) => {
      const deps = noteDeps(tx);
      if (pinned !== undefined) {
        const flagged = await setNoteFlags(deps, scope, id, { pinned });
        if (!flagged.ok) return fail(ctx, scope, flagged.error);
        if (content.title === undefined && content.body === undefined && !content.tagNames) {
          const [note] = await toNoteJson(tx, scope, [flagged.value]);
          return ctx.json(200, { data: note, meta: { outcome: 'saved' } });
        }
        content.version = flagged.value.version;
      }
      const result = await updateNote(deps, scope, id, {
        ...content,
        conflictLabel: conflictLabel ?? 'çatışma kopyası',
        fallbackTitle: '',
      });
      if (!result.ok) return fail(ctx, scope, result.error);
      const outcome = result.value;
      if (outcome.kind === 'deleted')
        return ctx.json(200, { data: null, meta: { outcome: 'deleted' } });
      if (outcome.kind === 'conflict_copy') {
        const [copy, current] = await toNoteJson(tx, scope, [outcome.note, outcome.current]);
        return ctx.json(200, { data: copy, meta: { outcome: 'conflict_copy', current } });
      }
      const [note] = await toNoteJson(tx, scope, [outcome.note]);
      return ctx.json(200, { data: note, meta: { outcome: 'saved' } });
    });
  });

/** PUT /notes/{id}/links `{ taskIds, projectIds }` (tam küme, BR-NOTE-003). */
export const putNoteLinks = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const body = await ctx.parse(Links);
    if (!body.ok) return body.response;
    const result = await db().transaction((tx) =>
      setNoteLinks(noteDeps(tx), scope, ctx.params.id ?? '', body.data),
    );
    return result.ok ? new Response(null, { status: 204 }) : fail(ctx, scope, result.error);
  });

const archive = (archived: boolean) => (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await setNoteFlags(noteDeps(db()), scope, ctx.params.id ?? '', { archived });
    if (!result.ok) return fail(ctx, scope, result.error);
    const [note] = await toNoteJson(db(), scope, [result.value]);
    return ctx.json(200, { data: note });
  });
export const postNoteArchive = archive(true);
export const postNoteUnarchive = archive(false);

/** DELETE /notes/{id}: çöpe taşır (BR-DEL-001/006); yanıt `{ batchId }`. */
export const deleteOneNote = (ctx: ApiContext) =>
  withScope(ctx, async (scope) => {
    const result = await deleteNote(noteDeps(db()), scope, ctx.params.id ?? '');
    return result.ok ? ctx.json(200, { data: result.value }) : fail(ctx, scope, result.error);
  });

/** Sunucu bileşenleri için. */
export async function findNotes(
  scope: WorkspaceScope,
  filter: { q?: string; linkedTaskId?: string; linkedProjectId?: string; tagId?: string } = {},
  fallbackTitle = '',
) {
  const result = await listNotes(noteDeps(db()), scope, filter);
  return result.ok ? toNoteJson(db(), scope, result.value, fallbackTitle) : [];
}

export async function findNote(scope: WorkspaceScope, id: string, fallbackTitle = '') {
  const result = await getNote(noteDeps(db()), scope, id, { includeDeleted: true });
  if (!result.ok) return null;
  const [note] = await toNoteJson(db(), scope, [result.value], fallbackTitle);
  return note ?? null;
}
