import { toProjectJson } from '@/modules/projects';
import type { TaskFilter, ViewSettings, ViewType } from '@/modules/views';
import type { WorkspaceScope } from '@/modules/workspaces';
import { db } from '@/shared/db/client';
import {
  dashboard,
  getTaskDetail,
  listSummaries,
  myTasks,
  myTasksCount,
} from '../application/organize';
import { listTrash } from '../application/lifecycle';
import { archiveContents, projectDetail, projectOverview } from '../application/projects';
import { queryTasks } from '../application/query';
import { inboxBadge, listTasks } from '../application/tasks';
import { todayIn } from '../domain/schedule';
import { TASK_STATUSES } from '../domain/task';
import { findRemindersForTasks } from '@/modules/reminders';
import { taskDeps, toReminderJson, toSummaryJson, toTaskJson } from './task-handlers';

/**
 * Sunucu bileşenleri için okuma sorguları; uç noktalarla aynı use case'leri kullanır (yetki dahil).
 * Bileşene API ile aynı biçimde (JSON) veri verilir.
 */
export type TaskView = ReturnType<typeof toSummaryJson>;
export type TaskDetailView = TaskView & {
  subtasks: TaskView[];
  reminders: ReturnType<typeof toReminderJson>[];
};

export async function findInboxTasks(scope: WorkspaceScope): Promise<TaskView[]> {
  const deps = taskDeps(db());
  const inbox = await deps.projects.inbox(scope);
  const result = await listTasks(deps, scope, { projectId: inbox.id });
  if (!result.ok) return [];
  return (await listSummaries(deps, scope, result.value)).map(toSummaryJson);
}

export async function findInboxCount(scope: WorkspaceScope): Promise<number> {
  const result = await inboxBadge(taskDeps(db()), scope);
  return result.ok ? result.value : 0;
}

export async function findMyTasks(
  scope: WorkspaceScope,
  prefs: { timezone: string; weekStart: number },
) {
  const result = await myTasks(taskDeps(db()), scope, {
    today: todayIn(prefs.timezone, new Date()),
    weekStart: prefs.weekStart,
  });
  return result.ok
    ? result.value.map(({ group, items }) => ({ group, tasks: items.map(toSummaryJson) }))
    : [];
}

export async function findTaskDetail(
  scope: WorkspaceScope,
  id: string,
): Promise<TaskDetailView | null> {
  // BR-DEL-007: çöpteki göreve doğrudan gidilirse "çöp kutusunda" bandıyla gösterilir.
  const result = await getTaskDetail(taskDeps(db()), scope, id, { includeDeleted: true });
  if (!result.ok) return null;
  const reminders = await findRemindersForTasks(db(), scope, [result.value.task.id]);
  return {
    ...toSummaryJson(result.value),
    subtasks: result.value.subtaskList.map(toSummaryJson),
    reminders: (reminders.get(result.value.task.id) ?? []).map(toReminderJson),
  };
}

export async function findMyTasksCount(scope: WorkspaceScope): Promise<number> {
  const result = await myTasksCount(taskDeps(db()), scope);
  return result.ok ? result.value : 0;
}

/** Bugün ekranının bölümleri (FR-DASH-01..04). */
export async function findDashboard(
  scope: WorkspaceScope,
  prefs: { timezone: string; weekStart: number },
) {
  const result = await dashboard(taskDeps(db()), scope, {
    today: todayIn(prefs.timezone, new Date()),
    weekStart: prefs.weekStart,
  });
  if (!result.ok) return null;
  const json = (items: typeof result.value.today) => items.map(toSummaryJson);
  return {
    today: json(result.value.today),
    overdue: json(result.value.overdue),
    upcoming: json(result.value.upcoming),
    priority: json(result.value.priority),
  };
}
export type DashboardView = NonNullable<Awaited<ReturnType<typeof findDashboard>>>;

/** "İlk adımlar" (ONBOARDING §4) için görevlerden hesaplanan ilerleme. */
export async function findTaskProgress(scope: WorkspaceScope) {
  const deps = taskDeps(db());
  const inbox = await deps.projects.inbox(scope);
  return deps.tasks.progressFlags(scope, inbox.id);
}

export type ProjectView = ReturnType<typeof toProjectJson>;

/** Projeler sayfası ve kenar çubuğu (FR-PROJ-03/04): standart projeler ilerlemeyle; Inbox hariç. */
export async function findProjectOverview(
  scope: WorkspaceScope,
  filter: { includeArchived?: boolean } = {},
): Promise<ProjectView[]> {
  const result = await projectOverview(taskDeps(db()), scope, filter);
  return result.ok ? result.value.map((p) => toProjectJson(p.project, p.progress)) : [];
}

/** Proje sayfası; BR-DEL-007: çöpteki projeye gidilirse "çöp kutusunda" ekranı için döner. */
export async function findProjectDetail(
  scope: WorkspaceScope,
  id: string,
): Promise<ProjectView | null> {
  const result = await projectDetail(taskDeps(db()), scope, id, { includeDeleted: true });
  return result.ok ? toProjectJson(result.value.project, result.value.progress) : null;
}

export type TaskListView = { tasks: TaskView[]; ignored: ('projectId' | 'tagId')[] };

/** Liste ve pano görünümleri (BR-VIEW-002): uç noktayla aynı sorgu. */
export async function findTaskList(
  scope: WorkspaceScope,
  prefs: { timezone: string; weekStart: number },
  filter: TaskFilter,
  settings: ViewSettings,
  viewType: ViewType,
  options: { includeDone?: boolean } = {},
): Promise<TaskListView> {
  const result = await queryTasks(taskDeps(db()), scope, filter, settings, {
    today: todayIn(prefs.timezone, new Date()),
    weekStart: prefs.weekStart,
    viewType,
    defaultStatuses: options.includeDone ? TASK_STATUSES : undefined,
  });
  return result.ok
    ? { tasks: result.value.items.map(toSummaryJson), ignored: result.value.ignored }
    : { tasks: [], ignored: [] };
}

/** Çöp kutusu sayfası (FR-SET-07). */
export async function findTrash(scope: WorkspaceScope) {
  const result = await listTrash(taskDeps(db()), scope);
  return result.ok
    ? result.value.map((g) => ({
        ...g,
        deletedAt: g.deletedAt.toISOString(),
        purgeAt: g.purgeAt.toISOString(),
      }))
    : [];
}
export type TrashGroupView = Awaited<ReturnType<typeof findTrash>>[number];

/** Arşiv sayfası (FR-SET-06). */
export async function findArchive(scope: WorkspaceScope) {
  const result = await archiveContents(taskDeps(db()), scope);
  if (!result.ok) return { projects: [], tasks: [] };
  return {
    projects: result.value.projects.map((p) => toProjectJson(p.project, p.progress)),
    tasks: result.value.tasks.map(({ task, project }) => ({ ...toTaskJson(task), project })),
  };
}
export type ArchiveView = Awaited<ReturnType<typeof findArchive>>;
