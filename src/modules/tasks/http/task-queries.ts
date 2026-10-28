import type { WorkspaceScope } from '@/modules/workspaces';
import { db } from '@/shared/db/client';
import {
  dashboard,
  getTaskDetail,
  listSummaries,
  myTasks,
  myTasksCount,
} from '../application/organize';
import { inboxBadge, listTasks } from '../application/tasks';
import { todayIn } from '../domain/schedule';
import { taskDeps, toSummaryJson } from './task-handlers';

/**
 * Sunucu bileşenleri için okuma sorguları; uç noktalarla aynı use case'leri kullanır (yetki dahil).
 * Bileşene API ile aynı biçimde (JSON) veri verilir.
 */
export type TaskView = ReturnType<typeof toSummaryJson>;
export type TaskDetailView = TaskView & { subtasks: TaskView[] };

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
  return result.ok
    ? { ...toSummaryJson(result.value), subtasks: result.value.subtaskList.map(toSummaryJson) }
    : null;
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
