import type { WorkspaceScope } from '@/modules/workspaces';
import { businessRule, type DomainError } from '@/shared/kernel/errors';
import type { Task } from '../domain/task';
import type { TaskDeps } from './ports';

/** BR-DEL-002: arşivlenmiş görev salt okunurdur; önce arşivden çıkarılmalıdır. */
const readOnly = (task: Task) => task.archivedAt !== null;

/**
 * Görev değiştirilebilir mi: BR-DEL-002 görevin kendisi arşivliyse, BR-PROJ-004 projesi arşivliyse salt okunur.
 * `allowArchivedTask`: arşivden çıkarma gibi arşivli görev üzerinde çalışan işlemler için.
 */
export async function checkWritable(
  deps: TaskDeps,
  scope: WorkspaceScope,
  task: Task,
  options: { allowArchivedTask?: boolean } = {},
): Promise<DomainError | null> {
  if (!options.allowArchivedTask && readOnly(task)) return businessRule('BR-DEL-002');
  const project = await deps.projects.find(scope, task.projectId);
  return project?.archived ? businessRule('BR-PROJ-004') : null;
}
