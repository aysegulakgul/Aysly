import { and, asc, count, eq, inArray, notInArray } from 'drizzle-orm';
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
