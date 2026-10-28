import { generateKeyBetween } from 'fractional-indexing';
import { authorize, type WorkspaceScope } from '@/modules/workspaces';
import type { Clock } from '@/shared/kernel/clock';
import {
  businessRule,
  notFound,
  validationError,
  type DomainError,
  type FieldIssue,
} from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import { checkStartBeforeDue, prepareDue, type DueInput } from '../domain/due';
import {
  OPEN_STATUSES,
  checkDescription,
  completion,
  normalizeTitle,
  reopening,
  type Priority,
  type Task,
  type TaskStatus,
} from '../domain/task';
import type { ProjectDirectory, TaskChanges, TaskRepository } from './ports';

export type TaskDeps = {
  tasks: TaskRepository;
  projects: ProjectDirectory;
  clock: Clock;
  newId: () => string;
};

export type CreateTaskCommand = {
  title: string;
  description?: string | null | undefined;
  projectId?: string | null | undefined;
  priority?: Priority | undefined;
  startDate?: string | null | undefined;
  due?: DueInput | null | undefined;
};

/** BR-DEL-002: arşivlenmiş görev salt okunurdur; önce arşivden çıkarılmalıdır. */
const readOnly = (task: Task) => task.archivedAt !== null;

/**
 * Görev oluşturma (API_CONTRACTS §6.3). BR-TASK-001 başlık, BR-TASK-002 proje verilmezse Inbox,
 * BR-PROJ-004 arşivlenmiş projeye görev eklenmez, BR-DATE-001/002 tarih kuralları, BR-TASK-006 sona eklenir.
 */
export async function createTask(
  deps: TaskDeps,
  scope: WorkspaceScope,
  command: CreateTaskCommand,
): Promise<Result<Task, DomainError>> {
  const allowed = authorize(scope, 'task.create');
  if (!allowed.ok) return allowed;

  const issues: FieldIssue[] = [];
  const title = normalizeTitle(command.title);
  if (!title.ok) issues.push(title.error);
  const description = command.description ?? null;
  issues.push(...checkDescription(description));
  const { due, issues: dueIssues } = prepareDue(command.due);
  issues.push(...dueIssues);
  const startDate = command.startDate ?? null;
  issues.push(...checkStartBeforeDue(startDate, due));
  if (issues.length > 0 || !title.ok) return err(validationError(issues));

  const project = command.projectId
    ? await deps.projects.find(scope, command.projectId)
    : await deps.projects.inbox(scope);
  if (!project) return err(notFound());
  if (project.archived) return err(businessRule('BR-PROJ-004'));

  const last = await deps.tasks.lastPosition(scope, project.id, null);
  const task = await deps.tasks.insert(scope, {
    id: deps.newId(),
    projectId: project.id,
    parentTaskId: null,
    title: title.value,
    description,
    priority: command.priority ?? 0,
    startDate,
    due,
    position: generateKeyBetween(last, null),
    createdBy: scope.userId,
    now: deps.clock.now(),
  });
  return ok(task);
}

export type UpdateTaskCommand = {
  version: number;
  title?: string | undefined;
  description?: string | null | undefined;
  status?: TaskStatus | undefined;
  priority?: Priority | undefined;
  startDate?: string | null | undefined;
  due?: DueInput | null | undefined;
};

/**
 * Kısmi güncelleme (API_CONTRACTS §6.4). BR-TASK-010 sürüm kontrolü; BR-TASK-003 `done` yalnızca tamamlama
 * işlemiyle; BR-DATE-002 tarihler birlikte denetlenir (yalnızca biri değişse de).
 */
export async function updateTask(
  deps: TaskDeps,
  scope: WorkspaceScope,
  id: string,
  command: UpdateTaskCommand,
): Promise<Result<Task, DomainError>> {
  const allowed = authorize(scope, 'task.update');
  if (!allowed.ok) return allowed;
  const current = await deps.tasks.findById(scope, id);
  if (!current) return err(notFound());
  if (readOnly(current)) return err(businessRule('BR-DEL-002'));

  const issues: FieldIssue[] = [];
  const changes: TaskChanges = {};
  if (command.title !== undefined) {
    const title = normalizeTitle(command.title);
    if (title.ok) changes.title = title.value;
    else issues.push(title.error);
  }
  if (command.description !== undefined) {
    issues.push(...checkDescription(command.description));
    changes.description = command.description;
  }
  if (command.status !== undefined) {
    // BR-TASK-003: tamamlama tek yoldan yapılır (/complete); yeniden açma /reopen ile.
    if (command.status === 'done' || current.status === 'done') {
      issues.push({ field: 'status', reason: 'use_complete_or_reopen' });
    } else changes.status = command.status;
  }
  if (command.priority !== undefined) changes.priority = command.priority;
  if (command.due !== undefined) {
    const prepared = prepareDue(command.due);
    issues.push(...prepared.issues);
    changes.due = prepared.due;
  }
  if (command.startDate !== undefined) changes.startDate = command.startDate;
  const startDate = changes.startDate !== undefined ? changes.startDate : current.startDate;
  const due = changes.due !== undefined ? changes.due : current.due;
  if (command.startDate !== undefined || command.due !== undefined) {
    issues.push(...checkStartBeforeDue(startDate, due));
  }
  if (issues.length > 0) return err(validationError(issues));

  return save(deps, scope, current, command.version, changes);
}

async function save(
  deps: TaskDeps,
  scope: WorkspaceScope,
  current: Task,
  version: number,
  changes: TaskChanges,
): Promise<Result<Task, DomainError>> {
  const updated = await deps.tasks.update(scope, current.id, version, changes, deps.clock.now());
  if (updated) return ok(updated);
  const latest = await deps.tasks.findById(scope, current.id);
  return latest ? err({ kind: 'version_conflict', current: latest }) : err(notFound());
}

/** BR-TASK-004: tamamlama. Zaten tamamlanmışsa değişiklik yapılmaz (aynı kayıt döner). */
export async function completeTask(
  deps: TaskDeps,
  scope: WorkspaceScope,
  id: string,
  command: { version: number },
): Promise<Result<Task, DomainError>> {
  const allowed = authorize(scope, 'task.complete');
  if (!allowed.ok) return allowed;
  const current = await deps.tasks.findById(scope, id);
  if (!current) return err(notFound());
  if (readOnly(current)) return err(businessRule('BR-DEL-002'));
  const changes = completion(current, deps.clock.now(), scope.userId);
  if (!changes) return ok(current);
  return save(deps, scope, current, command.version, changes);
}

/** BR-TASK-004: yeniden açma; tamamlama bilgisi temizlenir. Açık görevde değişiklik yapılmaz. */
export async function reopenTask(
  deps: TaskDeps,
  scope: WorkspaceScope,
  id: string,
  command: { version: number },
): Promise<Result<Task, DomainError>> {
  const allowed = authorize(scope, 'task.complete');
  if (!allowed.ok) return allowed;
  const current = await deps.tasks.findById(scope, id);
  if (!current) return err(notFound());
  if (readOnly(current)) return err(businessRule('BR-DEL-002'));
  const changes = reopening(current);
  if (!changes) return ok(current);
  return save(deps, scope, current, command.version, changes);
}

export async function getTask(
  deps: TaskDeps,
  scope: WorkspaceScope,
  id: string,
): Promise<Result<Task, DomainError>> {
  const allowed = authorize(scope, 'task.read');
  if (!allowed.ok) return allowed;
  const task = await deps.tasks.findById(scope, id);
  return task ? ok(task) : err(notFound());
}

/** Liste (API_CONTRACTS §6.2, ilk sürüm): proje ve durum filtresi; varsayılan açık durumlar. */
export async function listTasks(
  deps: TaskDeps,
  scope: WorkspaceScope,
  filter: { projectId?: string | undefined; statuses?: readonly TaskStatus[] | undefined },
): Promise<Result<Task[], DomainError>> {
  const allowed = authorize(scope, 'task.read');
  if (!allowed.ok) return allowed;
  return ok(
    await deps.tasks.list(scope, {
      projectId: filter.projectId,
      statuses: filter.statuses?.length ? filter.statuses : OPEN_STATUSES,
    }),
  );
}
