import { authorize, type WorkspaceScope } from '@/modules/workspaces';
import { businessRule, notFound, validationError, type DomainError } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import type { Task } from '../domain/task';
import { daysLeft, isExpired, purgeAt } from '../domain/trash';
import { checkWritable } from './guards';
import type { TaskDeps } from './ports';
import { generateNextOccurrence } from './recurring';

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
  const blocked = await checkWritable(deps, scope, task);
  if (blocked) return err(blocked);
  if (task.version !== command.version) return err(conflict(task));
  const subtasks = (await deps.tasks.listSubtasks(scope, task.id)).filter((s) => !s.archivedAt);
  const now = deps.clock.now();
  const ids = [task.id, ...subtasks.map((s) => s.id)];
  await deps.tasks.setArchived(scope, ids, now, now);
  await deps.reminders.cancel(scope, ids, now); // BR-REM-003
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
  const blocked = await checkWritable(deps, scope, task, { allowArchivedTask: true });
  if (blocked) return err(blocked);
  if (task.version !== command.version) return err(conflict(task));
  const ids = [
    task.id,
    ...(await deps.tasks.subtasksArchivedWith(scope, task.id, task.archivedAt)),
  ];
  if (task.parentTaskId) {
    const parent = await deps.tasks.findById(scope, task.parentTaskId);
    if (parent?.archivedAt) ids.push(parent.id);
  }
  const now = deps.clock.now();
  await deps.tasks.setArchived(scope, ids, null, now);
  await deps.reminders.reactivate(scope, ids, now); // BR-REM-003
  return ok((await deps.tasks.findById(scope, id))!);
}

/**
 * Çöpe taşıma (BR-DEL-001/006, BR-SUB-004): görev ve alt görevleri tek silme grubuyla çöpe gider; 30 gün içinde
 * geri yüklenebilir. Sürüm kontrolü yapılmaz: silme tüm kaydı hedefler ve "Geri al" ile geri alınabilir.
 * BR-PROJ-004: arşivli projedeki görev tek başına çöpe atılamaz. Toplu silmede grup kimliği dışarıdan gelir.
 * BR-REC-006: tekrarlayan açık örnekte `this` yalnızca bu örneği siler ve seri sonraki örnekle sürer; `series`
 * (varsayılan) bu örnekle birlikte seriyi bitirir. BR-REM-003: bekleyen hatırlatıcılar iptal olur.
 */
export async function deleteTask(
  deps: TaskDeps,
  scope: WorkspaceScope,
  id: string,
  batchId: string = deps.newId(),
  options: { recurrenceScope?: 'this' | 'series' | undefined } = {},
): Promise<Result<{ batchId: string; affected: number; nextOccurrenceId?: string }, DomainError>> {
  const allowed = authorize(scope, 'task.delete');
  if (!allowed.ok) return allowed;
  const task = await deps.tasks.findById(scope, id);
  if (!task) return err(notFound());
  const blocked = await checkWritable(deps, scope, task, { allowArchivedTask: true });
  if (blocked) return err(blocked);
  const subtasks = await deps.tasks.listSubtasks(scope, task.id);
  const ids = [task.id, ...subtasks.map((s) => s.id)];
  const now = deps.clock.now();
  const affected = await deps.tasks.trash(scope, ids, batchId, now);
  await deps.reminders.cancel(scope, ids, now);
  if (options.recurrenceScope === 'this' && task.recurrence && task.status !== 'done') {
    const next = await generateNextOccurrence(deps, scope, task);
    if (next) return ok({ batchId, affected, nextOccurrenceId: next.id });
  }
  return ok({ batchId, affected });
}

/** BR-DEL-004: görevin projesi çöpteyse kullanıcı seçer — projeyi de geri yükle veya Inbox'a geri yükle. */
export type ProjectChoice = 'restore' | 'inbox';

export type RestoreCommand =
  | { batchId: string; projectChoice?: ProjectChoice | undefined }
  | {
      type?: 'task' | undefined;
      id: string;
      restoreParent?: boolean | undefined;
      projectChoice?: ProjectChoice | undefined;
    }
  | { type: 'project'; id: string };

/** Geri yüklenecek kayıtlar: grup, tek görev (BR-SUB-004 bağımlılıklarıyla) veya proje (projenin grubuyla). */
async function restoreTargets(
  deps: TaskDeps,
  scope: WorkspaceScope,
  command: RestoreCommand,
): Promise<Result<{ tasks: Task[]; projectIds: string[] }, DomainError>> {
  if ('batchId' in command || command.type === 'project') {
    let batchId: string;
    if ('batchId' in command) {
      batchId = command.batchId;
    } else {
      const project = await deps.projects.findAny(scope, command.id);
      if (!project?.deletedAt || !project.deletedBatchId) return err(notFound());
      batchId = project.deletedBatchId;
    }
    const projects = await deps.projects.listTrashed(scope, batchId);
    if (projects.length > 0) {
      const allowed = authorize(scope, 'project.restore');
      if (!allowed.ok) return allowed;
    }
    const now = deps.clock.now();
    if (projects.some((p) => isExpired(p.deletedAt!, now))) {
      return err(businessRule('BR-DEL-003'));
    }
    return ok({
      tasks: await deps.tasks.batchMembers(scope, batchId),
      projectIds: projects.map((p) => p.id),
    });
  }
  const task = await deps.tasks.findAny(scope, command.id);
  if (!task?.deletedAt) return err(notFound());
  const tasks = [task];
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
  return ok({ tasks, projectIds: [] });
}

/**
 * Geri yükleme (BR-DEL-004/006, BR-SUB-004, BR-PROJ-005). Süresi dolan grup geri yüklenemez (BR-DEL-003).
 * Projesi kalıcı silinmiş görev Inbox'a döner; projesi (başka bir grupla) çöpteyse `projectChoice` gerekir.
 */
export async function restoreFromTrash(
  deps: TaskDeps,
  scope: WorkspaceScope,
  command: RestoreCommand,
): Promise<Result<{ restored: number; movedToInbox: number }, DomainError>> {
  const allowed = authorize(scope, 'task.restore');
  if (!allowed.ok) return allowed;
  const now = deps.clock.now();
  const targets = await restoreTargets(deps, scope, command);
  if (!targets.ok) return targets;
  const { tasks } = targets.value;
  let { projectIds } = targets.value;
  if (tasks.length === 0 && projectIds.length === 0) return err(notFound());
  if (tasks.some((t) => t.deletedAt && isExpired(t.deletedAt, now))) {
    return err(businessRule('BR-DEL-003'));
  }

  // BR-DEL-004: hâlâ çöpte olan bir projeye bağlı görevler için kullanıcı seçimi gerekir.
  const roots = tasks.filter((t) => !t.parentTaskId || !tasks.some((o) => o.id === t.parentTaskId));
  const trashedProjects: string[] = [];
  for (const projectId of new Set(roots.map((t) => t.projectId))) {
    if (projectIds.includes(projectId)) continue;
    const project = await deps.projects.findAny(scope, projectId);
    if (project?.deletedAt) trashedProjects.push(projectId);
  }
  if (trashedProjects.length > 0) {
    const choice = 'projectChoice' in command ? command.projectChoice : undefined;
    if (!choice) {
      return err(businessRule('BR-DEL-004', [{ field: 'projectChoice', reason: 'required' }]));
    }
    if (choice === 'restore') {
      const restoreProject = authorize(scope, 'project.restore');
      if (!restoreProject.ok) return restoreProject;
      projectIds = [...projectIds, ...trashedProjects];
    }
  }

  const restoredProjects = await deps.projects.restore(scope, projectIds, now);
  const restoredTasks = await deps.tasks.restore(
    scope,
    tasks.map((t) => t.id),
    now,
  );
  await deps.reminders.reactivate(
    scope,
    tasks.filter((t) => t.status !== 'done' && !t.archivedAt).map((t) => t.id),
    now,
  ); // BR-REM-003
  // Projesi artık olmayan (kalıcı silinmiş) veya kullanıcının Inbox'ı seçtiği görevler Inbox'a döner.
  let movedToInbox = 0;
  const inbox = await deps.projects.inbox(scope);
  for (const task of roots) {
    if (task.parentTaskId || task.projectId === inbox.id) continue;
    if (await deps.projects.find(scope, task.projectId)) continue;
    const current = await deps.tasks.findById(scope, task.id);
    if (current) {
      await deps.tasks.update(scope, task.id, current.version, { projectId: inbox.id }, now);
      await deps.tasks.moveSubtasks(scope, task.id, inbox.id, now);
      movedToInbox++;
    }
  }
  return ok({ restored: restoredTasks + restoredProjects, movedToInbox });
}

export type TrashGroup = {
  batchId: string;
  deletedAt: Date;
  purgeAt: Date;
  daysLeft: number;
  expired: boolean;
  root: { type: 'task' | 'project'; id: string; title: string };
  /** Gruptaki görev sayısı (proje grubunda projenin görevleri). */
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
  const projects = new Map(
    (await deps.projects.listTrashed(scope)).map((p) => [p.deletedBatchId ?? p.id, p]),
  );
  const timing = (deletedAt: Date) => ({
    deletedAt,
    purgeAt: purgeAt(deletedAt),
    daysLeft: daysLeft(deletedAt, now),
    expired: isExpired(deletedAt, now),
  });
  const result: TrashGroup[] = [];
  for (const [batchId, project] of projects) {
    result.push({
      batchId,
      ...timing(project.deletedAt!),
      root: { type: 'project', id: project.id, title: project.name },
      count: (groups.get(batchId) ?? []).length,
    });
  }
  for (const [batchId, members] of groups) {
    if (projects.has(batchId)) continue;
    const root = members.find((m) => !members.some((o) => o.id === m.parentTaskId))!;
    result.push({
      batchId,
      ...timing(root.deletedAt!),
      root: { type: 'task', id: root.id, title: root.title },
      count: members.length,
    });
  }
  return ok(result.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime()));
}

/**
 * BR-DEL-005: kalıcı silme açık onay ister; grup verilmezse "Çöpü boşalt" (`trash.empty`). Silinen projede başka
 * grupla çöpte kalan görevler önce Inbox'a bağlanır (BR-DEL-004), sonra görevler ve projeler silinir.
 */
export async function purgeTrash(
  deps: TaskDeps,
  scope: WorkspaceScope,
  command: { batchId: string | null; confirm: boolean },
): Promise<Result<{ purged: number }, DomainError>> {
  const allowed = authorize(scope, command.batchId ? 'task.purge' : 'trash.empty');
  if (!allowed.ok) return allowed;
  if (!command.confirm) return err(validationError([{ field: 'confirm', reason: 'required' }]));
  const projects = await deps.projects.listTrashed(scope, command.batchId ?? undefined);
  if (projects.length > 0) {
    const purgeProject = authorize(scope, 'project.purge');
    if (!purgeProject.ok) return purgeProject;
    const inbox = await deps.projects.inbox(scope);
    await deps.tasks.reassignTrashed(
      scope,
      projects.map((p) => p.id),
      inbox.id,
    );
  }
  const purgedTasks = await deps.tasks.purge(scope, command.batchId);
  const purgedProjects = await deps.projects.purge(scope, command.batchId);
  return ok({ purged: purgedTasks + purgedProjects });
}
