import { and, asc, count, eq, inArray, ne, notInArray, sql } from 'drizzle-orm';
import type { WorkspaceScope } from '@/modules/workspaces';
import type { DbExecutor } from '@/shared/db/client';
import { uuidv7 } from '@/shared/kernel/id';
import { normalizeTagName } from '../domain/tag';
import { tags, taskTags } from './schema';

export type TagView = { id: string; name: string; color: string };

/** Çalışma alanındaki etiket sayısı (BR-TAG-003: en fazla 500). */
export async function countTags(db: DbExecutor, scope: WorkspaceScope): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(tags)
    .where(eq(tags.workspaceId, scope.workspaceId));
  return row?.n ?? 0;
}

/** Normalleştirilmiş adı eşleşmeyen etiketler (yeni oluşturulacaklar). */
export async function missingTagNames(
  db: DbExecutor,
  scope: WorkspaceScope,
  names: readonly string[],
): Promise<string[]> {
  if (names.length === 0) return [];
  const existing = await db
    .select({ key: tags.nameNormalized })
    .from(tags)
    .where(
      and(
        eq(tags.workspaceId, scope.workspaceId),
        inArray(tags.nameNormalized, names.map(normalizeTagName)),
      ),
    );
  const keys = new Set(existing.map((r) => r.key));
  return names.filter((n) => !keys.has(normalizeTagName(n)));
}

/**
 * BR-TAG-001: adlar yoksa oluşturulur, varsa mevcut etiket kullanılır; görevin etiket kümesi bu adlarla
 * değiştirilir. Çağıranın işlemi içinde çalışır.
 */
export async function replaceTaskTags(
  db: DbExecutor,
  scope: WorkspaceScope,
  taskId: string,
  names: readonly string[],
  now: Date,
): Promise<void> {
  let ids: string[] = [];
  if (names.length > 0) {
    await db
      .insert(tags)
      .values(
        names.map((name) => ({
          id: uuidv7(),
          workspaceId: scope.workspaceId,
          name,
          nameNormalized: normalizeTagName(name),
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoNothing({ target: [tags.workspaceId, tags.nameNormalized] });
    const rows = await db
      .select({ id: tags.id })
      .from(tags)
      .where(
        and(
          eq(tags.workspaceId, scope.workspaceId),
          inArray(tags.nameNormalized, names.map(normalizeTagName)),
        ),
      );
    ids = rows.map((r) => r.id);
  }
  await db
    .delete(taskTags)
    .where(
      and(
        eq(taskTags.workspaceId, scope.workspaceId),
        eq(taskTags.taskId, taskId),
        ids.length ? notInArray(taskTags.tagId, ids) : undefined,
      ),
    );
  if (ids.length) {
    await db
      .insert(taskTags)
      .values(ids.map((tagId) => ({ taskId, tagId, workspaceId: scope.workspaceId })))
      .onConflictDoNothing();
  }
}

/** Görevlerin etiketleri (ada göre sıralı). */
export async function findTagsForTasks(
  db: DbExecutor,
  scope: WorkspaceScope,
  taskIds: readonly string[],
): Promise<Map<string, TagView[]>> {
  const result = new Map<string, TagView[]>();
  if (taskIds.length === 0) return result;
  const rows = await db
    .select({ taskId: taskTags.taskId, id: tags.id, name: tags.name, color: tags.color })
    .from(taskTags)
    .innerJoin(tags, eq(tags.id, taskTags.tagId))
    .where(and(eq(taskTags.workspaceId, scope.workspaceId), inArray(taskTags.taskId, [...taskIds])))
    .orderBy(asc(tags.name));
  for (const { taskId, ...tag } of rows) {
    result.set(taskId, [...(result.get(taskId) ?? []), tag]);
  }
  return result;
}

export function listTags(db: DbExecutor, scope: WorkspaceScope): Promise<TagView[]> {
  return db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(tags)
    .where(eq(tags.workspaceId, scope.workspaceId))
    .orderBy(asc(tags.name));
}

/** Var olan etiket kimlikleri (kayıtlı görünümdeki silinmiş etiket referansı, BR-VIEW-001). */
export async function existingTagIds(
  db: DbExecutor,
  scope: WorkspaceScope,
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.workspaceId, scope.workspaceId), inArray(tags.id, [...ids])));
  return new Set(rows.map((r) => r.id));
}

/** TaskFilter `tagId` (API_CONTRACTS §6.2): `any` en az birini, `all` hepsini taşıyan görevler. */
export async function taskIdsWithTags(
  db: DbExecutor,
  scope: WorkspaceScope,
  tagIds: readonly string[],
  mode: 'any' | 'all',
): Promise<Set<string>> {
  if (tagIds.length === 0) return new Set();
  const rows = await db
    .select({ taskId: taskTags.taskId })
    .from(taskTags)
    .where(and(eq(taskTags.workspaceId, scope.workspaceId), inArray(taskTags.tagId, [...tagIds])))
    .groupBy(taskTags.taskId)
    .having(mode === 'all' ? sql`count(*) = ${tagIds.length}` : undefined);
  return new Set(rows.map((r) => r.taskId));
}

export type TagWithUsage = TagView & { tasks: number };

/** Ayarlar · Etiketler (D-085): etiketler kullanım sayılarıyla (API_CONTRACTS §7). */
export async function listTagsWithUsage(
  db: DbExecutor,
  scope: WorkspaceScope,
): Promise<TagWithUsage[]> {
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      tasks: sql<number>`count(${taskTags.taskId})`.mapWith(Number),
    })
    .from(tags)
    .leftJoin(taskTags, eq(taskTags.tagId, tags.id))
    .where(eq(tags.workspaceId, scope.workspaceId))
    .groupBy(tags.id)
    .orderBy(asc(tags.name));
  return rows;
}

export async function findTag(
  db: DbExecutor,
  scope: WorkspaceScope,
  id: string,
): Promise<TagWithUsage | null> {
  const all = await listTagsWithUsage(db, scope);
  return all.find((t) => t.id === id) ?? null;
}

/** BR-TAG-001: normalleştirilmiş adı başka bir etikette varsa o etiketin kimliği. */
export async function findTagByName(
  db: DbExecutor,
  scope: WorkspaceScope,
  name: string,
  exceptId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(
      and(
        eq(tags.workspaceId, scope.workspaceId),
        eq(tags.nameNormalized, normalizeTagName(name)),
        ne(tags.id, exceptId),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

export async function updateTagRow(
  db: DbExecutor,
  scope: WorkspaceScope,
  id: string,
  changes: { name?: string | undefined; color?: string | undefined },
  now: Date,
): Promise<boolean> {
  const rows = await db
    .update(tags)
    .set({
      ...(changes.name !== undefined
        ? { name: changes.name, nameNormalized: normalizeTagName(changes.name) }
        : {}),
      ...(changes.color !== undefined ? { color: changes.color } : {}),
      updatedAt: now,
    })
    .where(and(eq(tags.workspaceId, scope.workspaceId), eq(tags.id, id)))
    .returning({ id: tags.id });
  return rows.length > 0;
}

/** BR-TAG-002: etiket silme kalıcıdır; görev bağlantıları yabancı anahtarla birlikte kalkar. */
export async function deleteTagRow(db: DbExecutor, scope: WorkspaceScope, id: string) {
  const rows = await db
    .delete(tags)
    .where(and(eq(tags.workspaceId, scope.workspaceId), eq(tags.id, id)))
    .returning({ id: tags.id });
  return rows.length > 0;
}
