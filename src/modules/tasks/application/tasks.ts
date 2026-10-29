import { generateKeyBetween } from 'fractional-indexing';
import { authorize, type WorkspaceScope } from '@/modules/workspaces';
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
import { TAGS_PER_RECORD, TAGS_PER_WORKSPACE, prepareTagNames } from '@/modules/tags';
import { checkWritable } from './guards';
import {
  generateNextOccurrence,
  prepareRecurrence,
  undoGeneratedOccurrence,
  type RecurrenceInput,
} from './recurring';
import { addReminder, recomputeRelative, type ReminderInput } from './reminders';
import type { TaskChanges, TaskDeps } from './ports';

export type { TaskDeps } from './ports';

export type CreateTaskCommand = {
  title: string;
  description?: string | null | undefined;
  projectId?: string | null | undefined;
  priority?: Priority | undefined;
  startDate?: string | null | undefined;
  due?: DueInput | null | undefined;
  parentTaskId?: string | null | undefined;
  tagNames?: readonly string[] | undefined;
  /** BR-REC-001/003 */
  recurrence?: RecurrenceInput | null | undefined;
  /** BR-REM-001/002: oluşturmayla birlikte en fazla 5 hatırlatıcı. */
  reminders?: readonly ReminderInput[] | undefined;
};

export const SUBTASKS_PER_TASK = 100; // BR-SUB-005

/**
 * BR-TAG-001/003: adlar normalleştirilir; kayıt başına en fazla 20, çalışma alanında en fazla 500 etiket.
 * Hata yoksa uygulanacak ad listesi döner.
 */
async function checkTags(
  deps: TaskDeps,
  scope: WorkspaceScope,
  raw: readonly string[] | undefined,
): Promise<Result<string[] | undefined, DomainError>> {
  if (raw === undefined) return ok(undefined);
  const { names, issues } = prepareTagNames(raw);
  if (issues.length) return err(validationError(issues));
  if (names.length > TAGS_PER_RECORD) return err(businessRule('BR-TAG-003'));
  const missing = await deps.tags.missing(scope, names);
  if (missing.length && (await deps.tags.count(scope)) + missing.length > TAGS_PER_WORKSPACE) {
    return err(businessRule('BR-TAG-003'));
  }
  return ok(names);
}

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
  const tagNames = await checkTags(deps, scope, command.tagNames);
  if (!tagNames.ok) return tagNames;

  // BR-SUB-001/002/005: alt görev üst düzey bir göreve bağlanır, projesi ebeveyninkidir.
  let parentTaskId: string | null = null;
  let projectId: string;
  if (command.parentTaskId) {
    const parent = await deps.tasks.findById(scope, command.parentTaskId);
    if (!parent) return err(notFound());
    if (parent.parentTaskId !== null) return err(businessRule('BR-SUB-001'));
    const blocked = await checkWritable(deps, scope, parent);
    if (blocked) return err(blocked);
    const siblings = await deps.tasks.subtaskCounts(scope, [parent.id]);
    if ((siblings.get(parent.id)?.total ?? 0) >= SUBTASKS_PER_TASK) {
      return err(businessRule('BR-SUB-005'));
    }
    parentTaskId = parent.id;
    projectId = parent.projectId;
  } else {
    const project = command.projectId
      ? await deps.projects.find(scope, command.projectId)
      : await deps.projects.inbox(scope);
    if (!project) return err(notFound());
    if (project.archived) return err(businessRule('BR-PROJ-004'));
    projectId = project.id;
  }

  let recurrence = null;
  if (command.recurrence) {
    const prepared = prepareRecurrence(command.recurrence, {
      due,
      parentTaskId,
      current: null,
      newId: deps.newId,
    });
    if (!prepared.ok) return prepared;
    recurrence = prepared.value;
  }

  const now = deps.clock.now();
  const last = await deps.tasks.lastPosition(scope, projectId, parentTaskId);
  const task = await deps.tasks.insert(scope, {
    recurrence,
    id: deps.newId(),
    projectId,
    parentTaskId,
    title: title.value,
    description,
    priority: command.priority ?? 0,
    startDate,
    due,
    position: generateKeyBetween(last, null),
    createdBy: scope.userId,
    now,
  });
  if (tagNames.value?.length) await deps.tags.replace(scope, task.id, tagNames.value, now);
  for (const reminder of command.reminders ?? []) {
    const added = await addReminder(deps, scope, task.id, reminder);
    if (!added.ok) return added;
  }
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
  tagNames?: readonly string[] | undefined;
  /** BR-REC-006: `null` seriyi durdurur (görev normal görev olarak kalır). */
  recurrence?: RecurrenceInput | null | undefined;
  /** BR-REC-006: tekrarlayan görevin tarihi değişirken "yalnızca bu örnek" / "bu ve sonraki örnekler". */
  recurrenceScope?: 'this' | 'following' | undefined;
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
  const blocked = await checkWritable(deps, scope, current);
  if (blocked) return err(blocked);

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
  // BR-REC-001/006: tekrar kuralı ve tekrarlayan görevin tarihi.
  if (command.recurrence !== undefined) {
    if (command.recurrence === null) changes.recurrence = null;
    else {
      const prepared = prepareRecurrence(command.recurrence, {
        due,
        parentTaskId: current.parentTaskId,
        current: current.recurrence,
        newId: deps.newId,
      });
      if (!prepared.ok) return prepared;
      changes.recurrence = prepared.value;
    }
  } else if (current.recurrence && command.due !== undefined) {
    if (due === null) return err(businessRule('BR-REC-001'));
    if (!command.recurrenceScope) issues.push({ field: 'recurrenceScope', reason: 'required' });
    else if (command.recurrenceScope === 'following' && changes.due) {
      changes.recurrence = { ...current.recurrence, anchor: changes.due.date };
    }
  }
  if (issues.length > 0) return err(validationError(issues));
  const tagNames = await checkTags(deps, scope, command.tagNames);
  if (!tagNames.ok) return tagNames;

  const saved = await save(deps, scope, current, command.version, changes);
  if (saved.ok && tagNames.value !== undefined) {
    await deps.tags.replace(scope, current.id, tagNames.value, deps.clock.now());
  }
  // BR-REM-004: son tarih değişince göreli hatırlatıcılar aynı işlemde yeniden hesaplanır.
  if (saved.ok && command.due !== undefined) await recomputeRelative(deps, scope, saved.value);
  return saved;
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

/** Tamamlama sonucu: tekrarlayan görevde üretilen sonraki örnek (BR-REC-002). */
export type CompletedTask = Task & { nextOccurrence?: Task | null };

/**
 * BR-TASK-004: tamamlama. Zaten tamamlanmışsa değişiklik yapılmaz (aynı kayıt döner). BR-REM-003: bekleyen
 * hatırlatıcılar iptal olur. BR-REC-002: tekrarlayan görevde sonraki örnek aynı işlemde oluşturulur.
 */
export async function completeTask(
  deps: TaskDeps,
  scope: WorkspaceScope,
  id: string,
  command: { version: number; completeSubtasks?: boolean | undefined },
): Promise<Result<CompletedTask, DomainError>> {
  const allowed = authorize(scope, 'task.complete');
  if (!allowed.ok) return allowed;
  const current = await deps.tasks.findById(scope, id);
  if (!current) return err(notFound());
  const blocked = await checkWritable(deps, scope, current);
  if (blocked) return err(blocked);
  const now = deps.clock.now();
  const changes = completion(current, now, scope.userId);
  if (!changes) return ok(current);
  const saved = await save(deps, scope, current, command.version, changes);
  // BR-SUB-003: varsayılan yalnızca ana görev; istenirse açık alt görevler aynı işlemde tamamlanır.
  // Tüm alt görevlerin tamamlanması ebeveyni otomatik tamamlamaz (ters yön yok).
  if (!saved.ok) return saved;
  if (command.completeSubtasks) {
    await deps.tasks.completeOpenSubtasks(scope, current.id, now, scope.userId);
  }
  await deps.reminders.cancel(scope, [current.id], now);
  const nextOccurrence = await generateNextOccurrence(deps, scope, saved.value);
  return ok({ ...saved.value, nextOccurrence });
}

/**
 * BR-TASK-004: yeniden açma; tamamlama bilgisi temizlenir. Açık görevde değişiklik yapılmaz. BR-REM-003: zamanı
 * gelmemiş hatırlatıcılar yeniden bekler. BR-REC-007: üretilen sonraki örnek değiştirilmemişse silinir.
 */
export async function reopenTask(
  deps: TaskDeps,
  scope: WorkspaceScope,
  id: string,
  command: { version: number },
): Promise<Result<Task & { keptNextOccurrence?: boolean }, DomainError>> {
  const allowed = authorize(scope, 'task.complete');
  if (!allowed.ok) return allowed;
  const current = await deps.tasks.findById(scope, id);
  if (!current) return err(notFound());
  const blocked = await checkWritable(deps, scope, current);
  if (blocked) return err(blocked);
  const changes = reopening(current);
  if (!changes) return ok(current);
  const saved = await save(deps, scope, current, command.version, changes);
  if (!saved.ok) return saved;
  await deps.reminders.reactivate(scope, [current.id], deps.clock.now());
  const undo = await undoGeneratedOccurrence(deps, scope, saved.value);
  return ok({ ...saved.value, keptNextOccurrence: undo.keptNext });
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

/** BR-INBOX-003: Inbox rozeti = Inbox'taki açık, arşivlenmemiş, çöpte olmayan üst düzey görev sayısı. */
export async function inboxBadge(
  deps: TaskDeps,
  scope: WorkspaceScope,
): Promise<Result<number, DomainError>> {
  const allowed = authorize(scope, 'task.read');
  if (!allowed.ok) return allowed;
  const inbox = await deps.projects.inbox(scope);
  return ok(await deps.tasks.countOpen(scope, inbox.id));
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
