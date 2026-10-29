import type { Progress, Project, ProjectStatus } from '@/modules/projects';
import { authorize, type WorkspaceScope } from '@/modules/workspaces';
import { businessRule, notFound, type DomainError } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import type { Task } from '../domain/task';
import type { TaskDeps } from './tasks';

/**
 * Proje ile görevlerini birlikte ilgilendiren işlemler (ARCHITECTURE §4.3: tasks → projects yönü). Proje
 * kaydının kendi kuralları projects modülündedir; burada ilerleme, silme ve toplu tamamlama orkestre edilir.
 */
export type ProjectWithProgress = { project: Project; progress: Progress };

const NO_TASKS: Progress = { done: 0, total: 0 };

/** FR-PROJ-03/04, BR-PROJ-003: proje listesi ilerlemeyle; Inbox listede ve sayımlarda yer almaz (BR-PROJ-006). */
export async function projectOverview(
  deps: TaskDeps,
  scope: WorkspaceScope,
  filter: {
    statuses?: readonly ProjectStatus[] | undefined;
    includeArchived?: boolean | undefined;
  },
): Promise<Result<ProjectWithProgress[], DomainError>> {
  const allowed = authorize(scope, 'project.read');
  if (!allowed.ok) return allowed;
  const projects = await deps.projects.repo.list(scope, filter);
  const progress = await deps.tasks.progress(
    scope,
    projects.map((p) => p.id),
  );
  return ok(
    projects.map((project) => ({ project, progress: progress.get(project.id) ?? NO_TASKS })),
  );
}

/**
 * Proje detayı (API_CONTRACTS §5). BR-DEL-007: çöpteki proje yalnızca açıkça istendiğinde döner (arayüz
 * "çöp kutusunda" ekranı için).
 */
export async function projectDetail(
  deps: TaskDeps,
  scope: WorkspaceScope,
  id: string,
  options: { includeDeleted?: boolean } = {},
): Promise<Result<ProjectWithProgress, DomainError>> {
  const allowed = authorize(scope, 'project.read');
  if (!allowed.ok) return allowed;
  const project = options.includeDeleted
    ? await deps.projects.findAny(scope, id)
    : await deps.projects.repo.findById(scope, id);
  if (!project) return err(notFound());
  const progress = await deps.tasks.progress(scope, [project.id]);
  return ok({ project, progress: progress.get(project.id) ?? NO_TASKS });
}

/** BR-PROJ-005: onay penceresi (Figma 4:69484) etkilenecek görev sayısını ana görev / alt görev ayrımıyla gösterir. */
export async function projectDeletePreview(
  deps: TaskDeps,
  scope: WorkspaceScope,
  id: string,
): Promise<Result<{ tasks: number; topLevel: number; subtasks: number }, DomainError>> {
  const allowed = authorize(scope, 'project.delete');
  if (!allowed.ok) return allowed;
  const project = await deps.projects.repo.findById(scope, id);
  if (!project) return err(notFound());
  if (project.kind === 'inbox') return err(businessRule('BR-PROJ-006'));
  const tasks = await deps.tasks.inProject(scope, project.id);
  const subtasks = tasks.filter((t) => t.parentTaskId).length;
  return ok({ tasks: tasks.length, topLevel: tasks.length - subtasks, subtasks });
}

/**
 * BR-PROJ-005 (D-031): proje ve çöpte olmayan tüm görevleri tek silme grubuyla birlikte çöpe gider; daha önce
 * ayrı silinmiş görevler kendi gruplarında kalır. Arşivli proje de bütünüyle silinebilir (BR-PROJ-004.5).
 * BR-PROJ-006: Inbox silinemez.
 */
export async function deleteProject(
  deps: TaskDeps,
  scope: WorkspaceScope,
  id: string,
): Promise<Result<{ batchId: string; affected: { tasks: number } }, DomainError>> {
  const allowed = authorize(scope, 'project.delete');
  if (!allowed.ok) return allowed;
  const project = await deps.projects.repo.findById(scope, id);
  if (!project) return err(notFound());
  if (project.kind === 'inbox') return err(businessRule('BR-PROJ-006'));
  const batchId = deps.newId();
  const now = deps.clock.now();
  const taskIds = (await deps.tasks.inProject(scope, project.id)).map((t) => t.id);
  const tasks = await deps.tasks.trash(scope, taskIds, batchId, now);
  await deps.projects.trash(scope, project.id, batchId, now);
  return ok({ batchId, affected: { tasks } });
}

/**
 * BR-PROJ-002: projeyi "Tamamlandı" yapmak görevleri değiştirmez; kullanıcı "hepsini tamamla" derse açık görevler
 * aynı işlemde tamamlanır. Arşivli proje salt okunurdur (BR-PROJ-004), Inbox'ın durumu değişmez (BR-PROJ-006).
 */
export async function completeProject(
  deps: TaskDeps,
  scope: WorkspaceScope,
  id: string,
  command: { version: number; completeOpenTasks: boolean },
): Promise<Result<{ project: Project; completedTasks: number }, DomainError>> {
  const allowed = authorize(scope, 'project.update');
  if (!allowed.ok) return allowed;
  const current = await deps.projects.repo.findById(scope, id);
  if (!current) return err(notFound());
  if (current.kind === 'inbox') return err(businessRule('BR-PROJ-006'));
  if (current.archivedAt) return err(businessRule('BR-PROJ-004'));
  const now = deps.clock.now();
  const project =
    current.status === 'completed'
      ? current.version === command.version
        ? current
        : null
      : await deps.projects.repo.update(
          scope,
          current.id,
          command.version,
          { status: 'completed' },
          now,
        );
  if (!project) {
    const latest = await deps.projects.repo.findById(scope, current.id);
    return latest ? err({ kind: 'version_conflict', current: latest }) : err(notFound());
  }
  const completedTasks = command.completeOpenTasks
    ? await deps.tasks.completeOpenInProject(scope, project.id, now, scope.userId)
    : 0;
  return ok({ project, completedTasks });
}

export type ArchiveContents = {
  projects: ProjectWithProgress[];
  /** Tek başına arşivlenmiş görevler (arşivli projelerin görevleri proje altında görünür, BR-PROJ-004.2). */
  tasks: { task: Task; project: { id: string; name: string } }[];
};

/** Arşiv sayfası (FR-SET-06, API_CONTRACTS §13): türe göre arşivli kayıtlar, en yeni önce. */
export async function archiveContents(
  deps: TaskDeps,
  scope: WorkspaceScope,
): Promise<Result<ArchiveContents, DomainError>> {
  const allowed = authorize(scope, 'task.read');
  if (!allowed.ok) return allowed;
  const all = await deps.projects.repo.list(scope, { includeArchived: true });
  const archived = all
    .filter((p) => p.archivedAt)
    .sort((a, b) => b.archivedAt!.getTime() - a.archivedAt!.getTime());
  const progress = await deps.tasks.progress(
    scope,
    archived.map((p) => p.id),
  );
  const names = new Map(all.map((p) => [p.id, p.name]));
  const inbox = await deps.projects.inbox(scope);
  names.set(inbox.id, inbox.name);
  const archivedIds = new Set(archived.map((p) => p.id));
  const tasks = (await deps.tasks.listArchived(scope)).filter(
    (t) =>
      !archivedIds.has(t.projectId) &&
      // Ebeveyniyle birlikte arşivlenen alt görevler ebeveynin altında kalır (BR-SUB-004).
      !(t.parentTaskId && t.archivedAt),
  );
  return ok({
    projects: archived.map((project) => ({
      project,
      progress: progress.get(project.id) ?? NO_TASKS,
    })),
    tasks: tasks.map((task) => ({
      task,
      project: { id: task.projectId, name: names.get(task.projectId) ?? '' },
    })),
  });
}
