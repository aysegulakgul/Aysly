import { generateKeyBetween } from 'fractional-indexing';
import { authorize, type WorkspaceScope } from '@/modules/workspaces';
import { businessRule, notFound, type DomainError } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import { DUE_GROUPS, dueGroup, type DueGroup } from '../domain/schedule';
import type { Task } from '../domain/task';
import type { ProjectRef } from './ports';
import type { TaskDeps } from './tasks';

type Tag = { id: string; name: string; color: string };
export type TaskSummary = {
  task: Task;
  project: { id: string; name: string; kind: 'inbox' | 'standard' };
  tags: Tag[];
  subtasks: { total: number; done: number };
};

async function versionChecked(
  deps: TaskDeps,
  scope: WorkspaceScope,
  current: Task,
  version: number,
  changes: Parameters<TaskDeps['tasks']['update']>[3],
): Promise<Result<Task, DomainError>> {
  const updated = await deps.tasks.update(scope, current.id, version, changes, deps.clock.now());
  if (updated) return ok(updated);
  const latest = await deps.tasks.findById(scope, current.id);
  return latest ? err({ kind: 'version_conflict', current: latest }) : err(notFound());
}

/**
 * BR-INBOX-002: taşıma yalnızca projeyi ve hedefteki sırayı değiştirir; diğer alanlar korunur. BR-SUB-002:
 * alt görev tek başına taşınamaz, ebeveyn taşınınca alt görevler aynı işlemde taşınır. BR-PROJ-004: arşivli
 * projeye taşınamaz.
 */
export async function moveTask(
  deps: TaskDeps,
  scope: WorkspaceScope,
  id: string,
  command: { version: number; projectId: string },
): Promise<Result<Task, DomainError>> {
  const allowed = authorize(scope, 'task.update');
  if (!allowed.ok) return allowed;
  const current = await deps.tasks.findById(scope, id);
  if (!current) return err(notFound());
  if (current.archivedAt) return err(businessRule('BR-DEL-002'));
  if (current.parentTaskId) return err(businessRule('BR-SUB-002'));
  const target = await deps.projects.find(scope, command.projectId);
  if (!target) return err(notFound());
  if (target.archived) return err(businessRule('BR-PROJ-004'));
  if (target.id === current.projectId) return ok(current);

  const last = await deps.tasks.lastPosition(scope, target.id, null);
  const moved = await versionChecked(deps, scope, current, command.version, {
    projectId: target.id,
    position: generateKeyBetween(last, null),
  });
  if (moved.ok) await deps.tasks.moveSubtasks(scope, current.id, target.id, deps.clock.now());
  return moved;
}

/** BR-SUB-002: "bağımsız göreve dönüştür" — alt görev aynı projede üst düzey görev olur. */
export async function detachTask(
  deps: TaskDeps,
  scope: WorkspaceScope,
  id: string,
  command: { version: number },
): Promise<Result<Task, DomainError>> {
  const allowed = authorize(scope, 'task.update');
  if (!allowed.ok) return allowed;
  const current = await deps.tasks.findById(scope, id);
  if (!current) return err(notFound());
  if (current.archivedAt) return err(businessRule('BR-DEL-002'));
  if (!current.parentTaskId) return ok(current);
  const last = await deps.tasks.lastPosition(scope, current.projectId, null);
  return versionChecked(deps, scope, current, command.version, {
    parentTaskId: null,
    position: generateKeyBetween(last, null),
  });
}

async function summarize(
  deps: TaskDeps,
  scope: WorkspaceScope,
  tasks: Task[],
  projects: Map<string, ProjectRef>,
): Promise<TaskSummary[]> {
  const ids = tasks.map((t) => t.id);
  const [tags, counts] = await Promise.all([
    deps.tags.forTasks(scope, ids),
    deps.tasks.subtaskCounts(scope, ids),
  ]);
  return tasks.map((task) => {
    const project = projects.get(task.projectId);
    return {
      task,
      project: {
        id: task.projectId,
        name: project?.name ?? '',
        kind: project?.kind ?? 'standard',
      },
      tags: tags.get(task.id) ?? [],
      subtasks: counts.get(task.id) ?? { total: 0, done: 0 },
    };
  });
}

/** Görev detayı (API_CONTRACTS §6.1): proje, etiketler, alt görevler ve sayıları. */
export async function getTaskDetail(
  deps: TaskDeps,
  scope: WorkspaceScope,
  id: string,
  options: { includeDeleted?: boolean } = {},
): Promise<Result<TaskSummary & { subtaskList: TaskSummary[] }, DomainError>> {
  const allowed = authorize(scope, 'task.read');
  if (!allowed.ok) return allowed;
  // BR-DEL-007: çöpteki kayıt yalnızca açıkça istendiğinde döner (arayüz "çöp kutusunda" ekranı için).
  const task = options.includeDeleted
    ? await deps.tasks.findAny(scope, id)
    : await deps.tasks.findById(scope, id);
  if (!task) return err(notFound());
  const project = await deps.projects.find(scope, task.projectId);
  const projects = new Map(project ? [[project.id, project]] : []);
  const subtasks = await deps.tasks.listSubtasks(scope, task.id);
  const [summary] = await summarize(deps, scope, [task], projects);
  return ok({ ...summary!, subtaskList: await summarize(deps, scope, subtasks, projects) });
}

/**
 * Görevlerim (BR-INBOX-004): kişisel alandaki arşivlenmemiş projelerin açık üst düzey görevleri, son tarihe göre
 * gruplu (BR-DATE-003/004). Boş gruplar dönmez.
 */
export async function myTasks(
  deps: TaskDeps,
  scope: WorkspaceScope,
  context: { today: string; weekStart: number },
): Promise<Result<{ group: DueGroup; items: TaskSummary[] }[], DomainError>> {
  const allowed = authorize(scope, 'task.read');
  if (!allowed.ok) return allowed;
  const projects = await deps.projects.listActive(scope);
  const byId = new Map(projects.map((p) => [p.id, p]));
  const tasks = await deps.tasks.listOpenInProjects(scope, [...byId.keys()]);
  const summaries = await summarize(deps, scope, tasks, byId);
  const now = deps.clock.now();
  const groups = new Map<DueGroup, TaskSummary[]>();
  for (const item of summaries) {
    const group = dueGroup(item.task.due, { ...context, now });
    groups.set(group, [...(groups.get(group) ?? []), item]);
  }
  return ok(
    DUE_GROUPS.filter((g) => groups.has(g)).map((group) => ({ group, items: groups.get(group)! })),
  );
}

/** Kenar çubuğundaki Görevlerim sayısı: Görevlerim kapsamındaki açık üst düzey görevler (BR-INBOX-004). */
export async function myTasksCount(
  deps: TaskDeps,
  scope: WorkspaceScope,
): Promise<Result<number, DomainError>> {
  const allowed = authorize(scope, 'task.read');
  if (!allowed.ok) return allowed;
  const projects = await deps.projects.listActive(scope);
  const tasks = await deps.tasks.listOpenInProjects(
    scope,
    projects.map((p) => p.id),
  );
  return ok(tasks.length);
}

/** Liste + özet bilgiler (proje adı, etiketler, alt görev sayıları). */
export async function listSummaries(
  deps: TaskDeps,
  scope: WorkspaceScope,
  tasks: Task[],
): Promise<TaskSummary[]> {
  const projects = new Map((await deps.projects.listActive(scope)).map((p) => [p.id, p]));
  return summarize(deps, scope, tasks, projects);
}
