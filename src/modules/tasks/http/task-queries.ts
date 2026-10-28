import type { WorkspaceScope } from '@/modules/workspaces';
import { db } from '@/shared/db/client';
import { inboxBadge, listTasks } from '../application/tasks';
import { taskDeps, toTaskJson } from './task-handlers';

/**
 * Sunucu bileşenleri için okuma sorguları; uç noktalarla aynı use case'leri kullanır (yetki dahil).
 * Bileşene API ile aynı biçimde (JSON) veri verilir.
 */
export type TaskView = ReturnType<typeof toTaskJson>;

export async function findInboxTasks(scope: WorkspaceScope): Promise<TaskView[]> {
  const deps = taskDeps(db());
  const inbox = await deps.projects.inbox(scope);
  const result = await listTasks(deps, scope, { projectId: inbox.id });
  return result.ok ? result.value.map(toTaskJson) : [];
}

export async function findInboxCount(scope: WorkspaceScope): Promise<number> {
  const result = await inboxBadge(taskDeps(db()), scope);
  return result.ok ? result.value : 0;
}
