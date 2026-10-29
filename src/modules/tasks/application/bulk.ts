import { authorize, type WorkspaceScope } from '@/modules/workspaces';
import type { BulkFailure, DomainError } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import { normalizeTagName } from '@/modules/tags';
import type { DueInput } from '../domain/due';
import type { Priority } from '../domain/task';
import { archiveTask, deleteTask } from './lifecycle';
import { moveTask } from './organize';
import { completeTask, reopenTask, updateTask, type TaskDeps } from './tasks';

export const BULK_LIMIT = 200; // BR-TASK-008

/** D-084: toplu yapılabilen işlemler (API_CONTRACTS §6.6). */
export type BulkAction =
  | { action: 'complete' }
  | { action: 'reopen' }
  | { action: 'move'; projectId: string }
  | { action: 'setStatus'; status: 'todo' | 'in_progress' }
  | { action: 'setDue'; due: DueInput | null }
  | { action: 'setPriority'; priority: Priority }
  | { action: 'addTags'; tagNames: readonly string[] }
  | { action: 'removeTags'; tagNames: readonly string[] }
  | { action: 'archive' }
  | { action: 'delete' };

const failureOf = (id: string, error: DomainError): BulkFailure => {
  switch (error.kind) {
    case 'business_rule':
      return { id, code: 'BUSINESS_RULE_VIOLATION', rule: error.rule };
    case 'validation':
      return { id, code: 'VALIDATION_FAILED' };
    case 'not_found':
      return { id, code: 'NOT_FOUND' };
    case 'forbidden':
      return { id, code: 'FORBIDDEN' };
    default:
      return { id, code: 'VERSION_CONFLICT' };
  }
};

/**
 * BR-TASK-008: tek istekte en fazla 200 görev; her görev için tekil işlemle aynı kurallar uygulanır. Sürüm kontrolü
 * yapılmaz (D-060: kullanıcı açıkça toplu değişiklik istiyor). Herhangi bir görev reddedilirse `bulk_rejected`
 * döner ve çağıran işlemi geri alır (atomiklik HTTP katmanındaki veritabanı işlemiyle sağlanır). Toplu silme tek
 * silme grubuyla yapılır, tek "Geri al" ile geri alınır (BR-DEL-006).
 */
export async function bulkTasks(
  deps: TaskDeps,
  scope: WorkspaceScope,
  command: BulkAction & { taskIds: readonly string[] },
): Promise<Result<{ affected: number; batchId?: string }, DomainError>> {
  const allowed = authorize(scope, 'task.read');
  if (!allowed.ok) return allowed;
  const ids = [...new Set(command.taskIds)];
  const batchId = command.action === 'delete' ? deps.newId() : undefined;
  const failures: BulkFailure[] = [];
  let affected = 0;

  for (const id of ids) {
    const task = await deps.tasks.findById(scope, id);
    if (!task) {
      // Aynı istekte ebeveyniyle birlikte çöpe giden alt görev hata sayılmaz.
      const gone = batchId ? await deps.tasks.findAny(scope, id) : null;
      if (gone?.deletedBatchId === batchId && batchId) continue;
      failures.push({ id, code: 'NOT_FOUND' });
      continue;
    }
    const version = task.version;
    let result: Result<unknown, DomainError>;
    switch (command.action) {
      case 'complete':
        result = await completeTask(deps, scope, id, { version });
        break;
      case 'reopen':
        result = await reopenTask(deps, scope, id, { version });
        break;
      case 'move':
        result = await moveTask(deps, scope, id, { version, projectId: command.projectId });
        break;
      case 'setStatus':
        result =
          task.status === command.status
            ? ok(task)
            : await updateTask(deps, scope, id, { version, status: command.status });
        break;
      case 'setDue':
        // BR-REC-006: toplu tarih değişikliği tekrarlayan görevde yalnızca bu örneği taşır.
        result = await updateTask(deps, scope, id, {
          version,
          due: command.due,
          ...(task.recurrence ? { recurrenceScope: 'this' as const } : {}),
        });
        break;
      case 'setPriority':
        result = await updateTask(deps, scope, id, { version, priority: command.priority });
        break;
      case 'addTags':
      case 'removeTags': {
        const current = ((await deps.tags.forTasks(scope, [id])).get(id) ?? []).map((t) => t.name);
        const keys = new Set(command.tagNames.map(normalizeTagName));
        const tagNames =
          command.action === 'addTags'
            ? [...current, ...command.tagNames]
            : current.filter((name) => !keys.has(normalizeTagName(name)));
        result = await updateTask(deps, scope, id, { version, tagNames });
        break;
      }
      case 'archive':
        result = await archiveTask(deps, scope, id, { version });
        break;
      case 'delete':
        result = await deleteTask(deps, scope, id, batchId);
        break;
    }
    if (result.ok) affected++;
    else failures.push(failureOf(id, result.error));
  }

  if (failures.length > 0) return err({ kind: 'bulk_rejected', failures });
  return ok(batchId ? { affected, batchId } : { affected });
}
