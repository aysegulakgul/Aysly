import { generateKeyBetween } from 'fractional-indexing';
import { authorize, type WorkspaceScope } from '@/modules/workspaces';
import { businessRule, notFound, validationError, type DomainError } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import { DUE_GROUPS, dueGroup, isUpcoming, type DueGroup } from '../domain/schedule';
import type { Task } from '../domain/task';
import type { ProjectRef } from './ports';
import { checkWritable, type TaskDeps } from './tasks';

type Tag = { id: string; name: string; color: string };
export type TaskSummary = {
  task: Task;
  project: { id: string; name: string; kind: 'inbox' | 'standard'; color: string };
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
  command: {
    version: number;
    projectId?: string | undefined;
    beforeId?: string | undefined;
    afterId?: string | undefined;
  },
): Promise<Result<Task, DomainError>> {
  const allowed = authorize(scope, 'task.update');
  if (!allowed.ok) return allowed;
  const current = await deps.tasks.findById(scope, id);
  if (!current) return err(notFound());
  const blocked = await checkWritable(deps, scope, current);
  if (blocked) return err(blocked);
  if (current.parentTaskId) return err(businessRule('BR-SUB-002'));
  const target = await deps.projects.find(scope, command.projectId ?? current.projectId);
  if (!target) return err(notFound());
  if (target.archived) return err(businessRule('BR-PROJ-004'));
  const changesProject = target.id !== current.projectId;
  if (!changesProject && !command.beforeId && !command.afterId) return ok(current);

  // BR-TASK-006: yalnızca taşınan görevin konumu değişir; komşular hedef projenin üst düzey görevleridir.
  const neighbour = async (neighbourId: string | undefined) => {
    if (!neighbourId) return null;
    const task = await deps.tasks.findById(scope, neighbourId);
    return task && task.projectId === target.id && !task.parentTaskId && task.id !== current.id
      ? task
      : undefined;
  };
  const after = await neighbour(command.afterId);
  const before = await neighbour(command.beforeId);
  if (after === undefined || before === undefined) return err(notFound());
  let position: string;
  if (after || before) {
    const lower = after?.position ?? null;
    const upper = before?.position ?? null;
    if (lower !== null && upper !== null && lower >= upper) {
      return err(validationError([{ field: 'beforeId', reason: 'invalid' }]));
    }
    position = generateKeyBetween(lower, upper);
  } else {
    position = generateKeyBetween(await deps.tasks.lastPosition(scope, target.id, null), null);
  }
  const moved = await versionChecked(deps, scope, current, command.version, {
    projectId: target.id,
    position,
  });
  if (moved.ok && changesProject) {
    await deps.tasks.moveSubtasks(scope, current.id, target.id, deps.clock.now());
  }
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
  const blocked = await checkWritable(deps, scope, current);
  if (blocked) return err(blocked);
  if (!current.parentTaskId) return ok(current);
  const last = await deps.tasks.lastPosition(scope, current.projectId, null);
  return versionChecked(deps, scope, current, command.version, {
    parentTaskId: null,
    position: generateKeyBetween(last, null),
  });
}

export async function summarize(
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
        color: project?.color ?? 'slate',
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

export type Dashboard = {
  today: TaskSummary[];
  overdue: TaskSummary[];
  upcoming: TaskSummary[];
  priority: TaskSummary[];
};

const PRIORITY_LIMIT = 10; // FR-DASH-04

/**
 * Dashboard bölümleri (FR-DASH-01..04, BR-DASH-002): "bugün" sunucuda kullanıcının saat diliminde hesaplanır
 * (BR-DATE-003). Bugün: saatli olanlar zaman sırasıyla, sonra tüm gün görevler; Geciken: en eski önce;
 * Yaklaşan: sonraki 7 gün; Öncelikli: yüksek öncelikli açık görevler (en fazla 10).
 */
export async function dashboard(
  deps: TaskDeps,
  scope: WorkspaceScope,
  context: { today: string; weekStart: number },
): Promise<Result<Dashboard, DomainError>> {
  const allowed = authorize(scope, 'task.read');
  if (!allowed.ok) return allowed;
  const projects = await deps.projects.listActive(scope);
  const byId = new Map(projects.map((p) => [p.id, p]));
  const tasks = await deps.tasks.listOpenInProjects(scope, [...byId.keys()]);
  const items = await summarize(deps, scope, tasks, byId);
  const now = deps.clock.now();
  const group = (item: TaskSummary) => dueGroup(item.task.due, { ...context, now });
  const timeOf = (item: TaskSummary) => item.task.due?.at?.getTime() ?? Number.POSITIVE_INFINITY;
  return ok({
    today: items.filter((i) => group(i) === 'today').sort((a, b) => timeOf(a) - timeOf(b)),
    overdue: items
      .filter((i) => group(i) === 'overdue')
      .sort((a, b) => (a.task.due!.date < b.task.due!.date ? -1 : 1)),
    upcoming: items
      .filter((i) => i.task.due && isUpcoming(i.task.due.date, context.today))
      .sort((a, b) => (a.task.due!.date < b.task.due!.date ? -1 : 1)),
    priority: items.filter((i) => i.task.priority === 3).slice(0, PRIORITY_LIMIT),
  });
}
