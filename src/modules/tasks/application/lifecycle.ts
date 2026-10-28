import { authorize, type WorkspaceScope } from '@/modules/workspaces';
import { businessRule, notFound, validationError, type DomainError } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import type { Task } from '../domain/task';
import { daysLeft, isExpired, purgeAt } from '../domain/trash';
import type { TaskDeps } from './tasks';

const conflict = (current: Task): DomainError => ({ kind: 'version_conflict', current });

/** BR-DEL-002: arşivlenen görev salt okunur olur; BR-SUB-004: alt görevler aynı işlemde arşivlenir. */
export async function archiveTask(
  deps: TaskDeps,
  scope: WorkspaceScope,
  id: string,
  command: { version: number },
): Promise<Result<Task, DomainError>> {
  const allowed = authorize(scope, 'task.archive');
  if (!allowed.ok) return allowed;
  const task = await deps.tasks.findById(scope, id);
  if (!task) return err(notFound());
  if (task.archivedAt) return ok(task);
  if (task.version !== command.version) return err(conflict(task));
  const subtasks = (await deps.tasks.listSubtasks(scope, task.id)).filter((s) => !s.archivedAt);
  const now = deps.clock.now();
  await deps.tasks.setArchived(scope, [task.id, ...subtasks.map((s) => s.id)], now, now);
  return ok((await deps.tasks.findById(scope, id))!);
}

/** Arşivden çıkarma: ebeveynle birlikte arşivlenen alt görevler de döner; alt görevin ebeveyni arşivliyse o da. */
export async function unarchiveTask(
  deps: TaskDeps,
  scope: WorkspaceScope,
  id: string,
  command: { version: number },
): Promise<Result<Task, DomainError>> {
  const allowed = authorize(scope, 'task.archive');
  if (!allowed.ok) return allowed;
  const task = await deps.tasks.findById(scope, id);
  if (!task) return err(notFound());
  if (!task.archivedAt) return ok(task);
  if (task.version !== command.version) return err(conflict(task));
  const ids = [
    task.id,
    ...(await deps.tasks.subtasksArchivedWith(scope, task.id, task.archivedAt)),
  ];
  if (task.parentTaskId) {
    const parent = await deps.tasks.findById(scope, task.parentTaskId);
    if (parent?.archivedAt) ids.push(parent.id);
  }
  await deps.tasks.setArchived(scope, ids, null, deps.clock.now());
  return ok((await deps.tasks.findById(scope, id))!);
}

/**
 * Çöpe taşıma (BR-DEL-001/006, BR-SUB-004): görev ve alt görevleri tek silme grubuyla çöpe gider; 30 gün içinde
 * geri yüklenebilir. Sürüm kontrolü yapılmaz: silme tüm kaydı hedefler ve "Geri al" ile geri alınabilir.
 */
export async function deleteTask(
  deps: TaskDeps,
  scope: WorkspaceScope,
  id: string,
): Promise<Result<{ batchId: string; affected: number }, DomainError>> {
  const allowed = authorize(scope, 'task.delete');
  if (!allowed.ok) return allowed;
  const task = await deps.tasks.findById(scope, id);
  if (!task) return err(notFound());
  const subtasks = await deps.tasks.listSubtasks(scope, task.id);
  const batchId = deps.newId();
  const affected = await deps.tasks.trash(
    scope,
    [task.id, ...subtasks.map((s) => s.id)],
    batchId,
    deps.clock.now(),
  );
  return ok({ batchId, affected });
}

export type RestoreCommand =
  { batchId: string } | { id: string; restoreParent?: boolean | undefined };

/**
 * Geri yükleme (BR-DEL-004/006, BR-SUB-004): grup veya tek kayıt. Süresi dolan grup geri yüklenemez
 * (BR-DEL-003). Ebeveyni çöpteki alt görev yalnızca ebeveyniyle birlikte geri yüklenir. Projesi artık yoksa
 * görev Inbox'a döner.
 */
export async function restoreFromTrash(
  deps: TaskDeps,
  scope: WorkspaceScope,
  command: RestoreCommand,
): Promise<Result<{ restored: number; movedToInbox: number }, DomainError>> {
  const allowed = authorize(scope, 'task.restore');
  if (!allowed.ok) return allowed;
  const now = deps.clock.now();
  let tasks: Task[];
  if ('batchId' in command) {
    tasks = await deps.tasks.batchMembers(scope, command.batchId);
  } else {
    const task = await deps.tasks.findAny(scope, command.id);
    if (!task?.deletedAt) return err(notFound());
    tasks = [task];
    // BR-SUB-004: ebeveyn geri yüklenince aynı gruptaki alt görevleri de döner.
    if (!task.parentTaskId && task.deletedBatchId) {
      const batch = await deps.tasks.batchMembers(scope, task.deletedBatchId);
      tasks.push(...batch.filter((t) => t.parentTaskId === task.id));
    }
    if (task.parentTaskId) {
      const parent = await deps.tasks.findAny(scope, task.parentTaskId);
      if (parent?.deletedAt) {
        if (!command.restoreParent) return err(businessRule('BR-SUB-004'));
        tasks.push(parent);
      }
    }
  }
  if (tasks.length === 0) return err(notFound());
  if (tasks.some((t) => t.deletedAt && isExpired(t.deletedAt, now))) {
    return err(businessRule('BR-DEL-003'));
  }

  const restored = await deps.tasks.restore(
    scope,
    tasks.map((t) => t.id),
    now,
  );
  // BR-DEL-004: proje artık yoksa Inbox'a (proje çöpü Faz 5'te; o zaman "projeyi de geri yükle" seçimi gelir).
  let movedToInbox = 0;
  const inbox = await deps.projects.inbox(scope);
  for (const task of tasks) {
    if (task.parentTaskId || task.projectId === inbox.id) continue;
    if (await deps.projects.find(scope, task.projectId)) continue;
    const current = await deps.tasks.findById(scope, task.id);
    if (current) {
      await deps.tasks.update(scope, task.id, current.version, { projectId: inbox.id }, now);
      await deps.tasks.moveSubtasks(scope, task.id, inbox.id, now);
      movedToInbox++;
    }
  }
  return ok({ restored, movedToInbox });
}

export type TrashGroup = {
  batchId: string;
  deletedAt: Date;
  purgeAt: Date;
  daysLeft: number;
  expired: boolean;
  root: { id: string; title: string };
  count: number;
};

/** Çöp kutusu (API_CONTRACTS §13): silme gruplarına göre, en yeni önce; kalan gün (BR-DEL-003). */
export async function listTrash(
  deps: TaskDeps,
  scope: WorkspaceScope,
): Promise<Result<TrashGroup[], DomainError>> {
  const allowed = authorize(scope, 'task.read');
  if (!allowed.ok) return allowed;
  const now = deps.clock.now();
  const groups = new Map<string, Task[]>();
  for (const task of await deps.tasks.listTrash(scope)) {
    const batch = task.deletedBatchId ?? task.id;
    groups.set(batch, [...(groups.get(batch) ?? []), task]);
  }
  return ok(
    [...groups.entries()]
      .map(([batchId, members]) => {
        const root = members.find((m) => !members.some((o) => o.id === m.parentTaskId))!;
        const deletedAt = root.deletedAt!;
        return {
          batchId,
          deletedAt,
          purgeAt: purgeAt(deletedAt),
          daysLeft: daysLeft(deletedAt, now),
          expired: isExpired(deletedAt, now),
          root: { id: root.id, title: root.title },
          count: members.length,
        };
      })
      .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime()),
  );
}

/** BR-DEL-005: kalıcı silme açık onay ister; grup verilmezse "Çöpü boşalt" (`trash.empty`). */
export async function purgeTrash(
  deps: TaskDeps,
  scope: WorkspaceScope,
  command: { batchId: string | null; confirm: boolean },
): Promise<Result<{ purged: number }, DomainError>> {
  const allowed = authorize(scope, command.batchId ? 'task.purge' : 'trash.empty');
  if (!allowed.ok) return allowed;
  if (!command.confirm) return err(validationError([{ field: 'confirm', reason: 'required' }]));
  return ok({ purged: await deps.tasks.purge(scope, command.batchId) });
}
