import type { FieldIssue } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import type { Due } from './due';

/** BR-TASK-003 (D-041): durumlar. `done`'a yalnızca tamamlama işlemiyle geçilir. */
export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const OPEN_STATUSES = ['todo', 'in_progress'] as const;

/** BR-TASK-005: 0 = yok, 1 = düşük, 2 = orta, 3 = yüksek. */
export type Priority = 0 | 1 | 2 | 3;

export type Task = {
  id: string;
  workspaceId: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  startDate: string | null;
  due: Due | null;
  completedAt: Date | null;
  completedBy: string | null;
  position: string;
  createdBy: string | null;
  archivedAt: Date | null;
  deletedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export const TITLE_MAX = 500;
export const DESCRIPTION_MAX = 20_000;

/** BR-TASK-001: kırpılır, satır sonları boşluğa çevrilir; sonuç 1–500 karakter. */
export function normalizeTitle(raw: string): Result<string, FieldIssue> {
  const title = raw.replace(/[\r\n]+/g, ' ').trim();
  if (title.length === 0) return err({ field: 'title', reason: 'required' });
  if (title.length > TITLE_MAX) return err({ field: 'title', reason: 'too_long' });
  return ok(title);
}

export function checkDescription(description: string | null): FieldIssue[] {
  return description !== null && description.length > DESCRIPTION_MAX
    ? [{ field: 'description', reason: 'too_long' }]
    : [];
}

/** BR-TASK-004: tamamlamada zaman ve aktör yazılır. Zaten tamamlanmışsa değişiklik yok. */
export function completion(task: Task, now: Date, actorId: string) {
  if (task.status === 'done') return null;
  return { status: 'done' as const, completedAt: now, completedBy: actorId };
}

/** BR-TASK-004: yeniden açmada tamamlama bilgisi temizlenir; görev "Yapılacak" durumuna döner. */
export function reopening(task: Task) {
  if (task.status !== 'done') return null;
  return { status: 'todo' as const, completedAt: null, completedBy: null };
}
