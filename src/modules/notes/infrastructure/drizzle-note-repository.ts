import { and, desc, eq, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import type { WorkspaceScope } from '@/modules/workspaces';
import type { DbExecutor } from '@/shared/db/client';
import { isUuid } from '@/shared/kernel/id';
import type { NoteLinks, NoteRepository } from '../application/notes';
import { toPrefixQuery } from './search-query';
import type { Note } from '../domain/note';
import { noteProjectLinks, noteTaskLinks, notes } from './schema';

type Row = typeof notes.$inferSelect;
const toNote = (row: Row): Note => ({
  id: row.id,
  workspaceId: row.workspaceId,
  title: row.title,
  body: row.body,
  pinnedAt: row.pinnedAt,
  archivedAt: row.archivedAt,
  deletedAt: row.deletedAt,
  deletedBatchId: row.deletedBatchId,
  version: row.version,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
/** Arama vektörü okunmaz (üretilmiş kolon). */
const cols = {
  id: notes.id,
  workspaceId: notes.workspaceId,
  title: notes.title,
  body: notes.body,
  pinnedAt: notes.pinnedAt,
  archivedAt: notes.archivedAt,
  deletedAt: notes.deletedAt,
  deletedBatchId: notes.deletedBatchId,
  version: notes.version,
  createdAt: notes.createdAt,
  updatedAt: notes.updatedAt,
};

const inScope = (scope: WorkspaceScope) =>
  and(eq(notes.workspaceId, scope.workspaceId), isNull(notes.deletedAt));

export function createDrizzleNoteRepository(
  db: DbExecutor,
  /** TaskFilter benzeri etiket koşulu için tags modülünden (not kimlikleri). */
  noteIdsWithTag: (scope: WorkspaceScope, tagId: string) => Promise<Set<string>>,
): NoteRepository {
  return {
    async insert(scope, n) {
      const [row] = await db
        .insert(notes)
        .values({
          id: n.id,
          workspaceId: scope.workspaceId,
          title: n.title,
          body: n.body,
          createdBy: scope.userId,
          createdAt: n.now,
          updatedAt: n.now,
        })
        .returning(cols);
      return toNote(row as Row);
    },

    async findById(scope, id) {
      if (!isUuid(id)) return null;
      const [row] = await db
        .select(cols)
        .from(notes)
        .where(and(inScope(scope), eq(notes.id, id)))
        .limit(1);
      return row ? toNote(row as Row) : null;
    },

    async findAny(scope, id) {
      if (!isUuid(id)) return null;
      const [row] = await db
        .select(cols)
        .from(notes)
        .where(and(eq(notes.workspaceId, scope.workspaceId), eq(notes.id, id)))
        .limit(1);
      return row ? toNote(row as Row) : null;
    },

    async update(scope, id, expectedVersion, changes, now) {
      const [row] = await db
        .update(notes)
        .set({ ...changes, version: sql`${notes.version} + 1`, updatedAt: now })
        .where(
          and(
            inScope(scope),
            eq(notes.id, id),
            expectedVersion === null ? undefined : eq(notes.version, expectedVersion),
          ),
        )
        .returning(cols);
      return row ? toNote(row as Row) : null;
    },

    async list(scope, filter) {
      const conditions = [
        inScope(scope),
        filter.includeArchived ? undefined : isNull(notes.archivedAt),
      ];
      if (filter.q?.trim()) {
        // D-022: önek eşleşmeli tam metin arama; Türkçe harf/aksan farkı yok (FR-SRCH-02).
        const query = toPrefixQuery(filter.q);
        if (query)
          conditions.push(
            sql`${notes.searchVector} @@ to_tsquery('simple', aysly_search_text(${query}))`,
          );
      }
      if (filter.tagId) {
        const ids = [...(await noteIdsWithTag(scope, filter.tagId))];
        if (ids.length === 0) return [];
        conditions.push(inArray(notes.id, ids));
      }
      if (filter.linkedTaskId && isUuid(filter.linkedTaskId)) {
        conditions.push(
          sql`exists (select 1 from ${noteTaskLinks} l where l.note_id = ${notes.id} and l.task_id = ${filter.linkedTaskId})`,
        );
      }
      if (filter.linkedProjectId && isUuid(filter.linkedProjectId)) {
        conditions.push(
          sql`exists (select 1 from ${noteProjectLinks} l where l.note_id = ${notes.id} and l.project_id = ${filter.linkedProjectId})`,
        );
      }
      const rows = await db
        .select(cols)
        .from(notes)
        .where(and(...conditions))
        .orderBy(sql`${notes.pinnedAt} is null`, desc(notes.pinnedAt), desc(notes.updatedAt))
        .limit(500);
      return rows.map((r) => toNote(r as Row));
    },

    async trash(scope, id, batchId, now) {
      if (!isUuid(id)) return false;
      const rows = await db
        .update(notes)
        .set({
          deletedAt: now,
          deletedBatchId: batchId,
          version: sql`${notes.version} + 1`,
          updatedAt: now,
        })
        .where(and(inScope(scope), eq(notes.id, id)))
        .returning({ id: notes.id });
      return rows.length > 0;
    },

    async restore(scope, id, now) {
      if (!isUuid(id)) return false;
      const rows = await db
        .update(notes)
        .set({
          deletedAt: null,
          deletedBatchId: null,
          version: sql`${notes.version} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(notes.workspaceId, scope.workspaceId),
            eq(notes.id, id),
            isNotNull(notes.deletedAt),
          ),
        )
        .returning({ id: notes.id });
      return rows.length > 0;
    },

    async listTrashed(scope) {
      const rows = await db
        .select(cols)
        .from(notes)
        .where(and(eq(notes.workspaceId, scope.workspaceId), isNotNull(notes.deletedAt)))
        .orderBy(desc(notes.deletedAt));
      return rows.map((r) => toNote(r as Row));
    },

    async purge(scope, id) {
      if (id !== null && !isUuid(id)) return 0;
      const rows = await db
        .delete(notes)
        .where(
          and(
            eq(notes.workspaceId, scope.workspaceId),
            isNotNull(notes.deletedAt),
            id ? eq(notes.id, id) : undefined,
          ),
        )
        .returning({ id: notes.id });
      return rows.length;
    },

    async hardDelete(scope, id) {
      await db.delete(notes).where(and(eq(notes.workspaceId, scope.workspaceId), eq(notes.id, id)));
    },

    async links(scope, noteIds) {
      const result = new Map<string, NoteLinks>();
      if (noteIds.length === 0) return result;
      const ensure = (id: string) => {
        if (!result.has(id)) result.set(id, { taskIds: [], projectIds: [] });
        return result.get(id)!;
      };
      const [taskRows, projectRows] = await Promise.all([
        db
          .select({ noteId: noteTaskLinks.noteId, id: noteTaskLinks.taskId })
          .from(noteTaskLinks)
          .where(
            and(
              eq(noteTaskLinks.workspaceId, scope.workspaceId),
              inArray(noteTaskLinks.noteId, [...noteIds]),
            ),
          ),
        db
          .select({ noteId: noteProjectLinks.noteId, id: noteProjectLinks.projectId })
          .from(noteProjectLinks)
          .where(
            and(
              eq(noteProjectLinks.workspaceId, scope.workspaceId),
              inArray(noteProjectLinks.noteId, [...noteIds]),
            ),
          ),
      ]);
      for (const r of taskRows) ensure(r.noteId).taskIds.push(r.id);
      for (const r of projectRows) ensure(r.noteId).projectIds.push(r.id);
      return result;
    },

    async setLinks(scope, noteId, links, now) {
      await db
        .delete(noteTaskLinks)
        .where(
          and(eq(noteTaskLinks.workspaceId, scope.workspaceId), eq(noteTaskLinks.noteId, noteId)),
        );
      await db
        .delete(noteProjectLinks)
        .where(
          and(
            eq(noteProjectLinks.workspaceId, scope.workspaceId),
            eq(noteProjectLinks.noteId, noteId),
          ),
        );
      if (links.taskIds.length) {
        await db.insert(noteTaskLinks).values(
          links.taskIds.map((taskId) => ({
            noteId,
            taskId,
            workspaceId: scope.workspaceId,
            createdAt: now,
          })),
        );
      }
      if (links.projectIds.length) {
        await db.insert(noteProjectLinks).values(
          links.projectIds.map((projectId) => ({
            noteId,
            projectId,
            workspaceId: scope.workspaceId,
            createdAt: now,
          })),
        );
      }
    },
  };
}

/** BR-DEL-003: süresi dolan çöpteki notlar (tüm alanlar; sistem işi). */
export async function purgeExpiredNotes(db: DbExecutor, before: Date): Promise<number> {
  const rows = await db
    .delete(notes)
    .where(and(isNotNull(notes.deletedAt), lt(notes.deletedAt, before)))
    .returning({ id: notes.id });
  return rows.length;
}
