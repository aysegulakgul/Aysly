import { findActiveProjects } from '@/modules/projects';
import type { WorkspaceScope } from '@/modules/workspaces';
import type { Viewer } from '../../viewer';
import { todayIn } from './dates';
import type { TaskUiContext } from './task-context';

/** Sayfaların görev bileşenlerine verdiği bağlam (sunucuda, isteğin anında hesaplanır). */
export async function buildTaskContext(
  viewer: Viewer,
  scope: WorkspaceScope,
): Promise<TaskUiContext> {
  const { timezone, weekStart, timeFormat } = viewer.preferences;
  return {
    workspaceId: scope.workspaceId,
    timezone,
    weekStart,
    timeFormat,
    today: todayIn(timezone, new Date()),
    projects: await findActiveProjects(scope),
  };
}
