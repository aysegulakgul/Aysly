import { authorize, type WorkspaceScope } from '@/modules/workspaces';
import type { Clock } from '@/shared/kernel/clock';
import { businessRule, notFound, validationError, type DomainError } from '@/shared/kernel/errors';
import { isUuid } from '@/shared/kernel/id';
import { err, ok, type Result } from '@/shared/kernel/result';
import { prepareTagNames, type TagColor } from '../domain/tag';

export type ManagedTag = { id: string; name: string; color: string; tasks: number; notes: number };

/** Etiket yönetimi deposu (D-085). */
export type TagStore = {
  list(scope: WorkspaceScope): Promise<ManagedTag[]>;
  find(scope: WorkspaceScope, id: string): Promise<ManagedTag | null>;
  nameTakenBy(scope: WorkspaceScope, name: string, exceptId: string): Promise<string | null>;
  update(
    scope: WorkspaceScope,
    id: string,
    changes: { name?: string | undefined; color?: TagColor | undefined },
    now: Date,
  ): Promise<boolean>;
  remove(scope: WorkspaceScope, id: string): Promise<boolean>;
};

export type TagDeps = { tags: TagStore; clock: Clock };

export async function listManagedTags(
  deps: TagDeps,
  scope: WorkspaceScope,
): Promise<Result<ManagedTag[], DomainError>> {
  const allowed = authorize(scope, 'task.read');
  if (!allowed.ok) return allowed;
  return ok(await deps.tags.list(scope));
}

/**
 * Yeniden adlandırma ve renk (API_CONTRACTS §7). BR-TAG-001: ad 1–50 karakter, Türkçe karakter ve büyük/küçük
 * harf farkına duyarsız benzersiz; çakışmada 422 + mevcut etiketin kimliği.
 */
export async function updateTag(
  deps: TagDeps,
  scope: WorkspaceScope,
  id: string,
  command: { name?: string | undefined; color?: TagColor | undefined },
): Promise<Result<ManagedTag, DomainError>> {
  const allowed = authorize(scope, 'tag.manage');
  if (!allowed.ok) return allowed;
  if (!isUuid(id) || !(await deps.tags.find(scope, id))) return err(notFound());
  let name: string | undefined;
  if (command.name !== undefined) {
    const { names, issues } = prepareTagNames([command.name]);
    if (issues.length) return err(validationError(issues.map((i) => ({ ...i, field: 'name' }))));
    if (names.length === 0) return err(validationError([{ field: 'name', reason: 'required' }]));
    name = names[0]!;
    const taken = await deps.tags.nameTakenBy(scope, name, id);
    if (taken) return err(businessRule('BR-TAG-001', [{ field: 'existingTagId', reason: taken }]));
  }
  await deps.tags.update(scope, id, { name, color: command.color }, deps.clock.now());
  return ok((await deps.tags.find(scope, id))!);
}

/**
 * BR-TAG-002: silme kalıcıdır (çöpe gitmez); görevler silinmez, yalnızca bağlantılar kalkar. Kayıtlı
 * görünümlerdeki referanslar geçersiz olur (görünüm açılınca uyarı, BR-VIEW-001).
 */
export async function deleteTag(
  deps: TagDeps,
  scope: WorkspaceScope,
  id: string,
): Promise<Result<{ removedFrom: { tasks: number; notes: number } }, DomainError>> {
  const allowed = authorize(scope, 'tag.manage');
  if (!allowed.ok) return allowed;
  if (!isUuid(id)) return err(notFound());
  const tag = await deps.tags.find(scope, id);
  if (!tag) return err(notFound());
  await deps.tags.remove(scope, id);
  return ok({ removedFrom: { tasks: tag.tasks, notes: tag.notes } });
}
