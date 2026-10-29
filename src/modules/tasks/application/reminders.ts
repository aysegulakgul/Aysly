import {
  MAX_OFFSET_MINUTES,
  MIN_LEAD_MS,
  REMINDERS_PER_TASK,
  dispatchOutcome,
  relativeRemindAt,
  type Reminder,
  type ReminderStatus,
} from '@/modules/reminders';
import { authorize, type WorkspaceScope } from '@/modules/workspaces';
import type { Clock } from '@/shared/kernel/clock';
import { businessRule, notFound, validationError, type DomainError } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import { zonedTimeToUtc } from '../domain/due';
import type { Task } from '../domain/task';
import type { TaskDeps } from './ports';
import { checkWritable } from './guards';

export type ReminderInput =
  { kind: 'absolute'; remindAt: string } | { kind: 'relative'; offsetMinutes: number };

/** BR-REM-001: göreli hatırlatıcının anı, görevin son tarihine ve kullanıcının tüm gün saatine göre. */
async function relativeAt(deps: TaskDeps, scope: WorkspaceScope, task: Task, offset: number) {
  const prefs = await deps.calendar.of(scope.userId);
  return relativeRemindAt(task.due!, offset, prefs, zonedTimeToUtc);
}

/**
 * Hatırlatıcı ekleme (API_CONTRACTS §8). BR-REM-001: göreli hatırlatıcı yalnızca son tarihli görevde.
 * BR-REM-002: görev başına en fazla 5; an en az 1 dakika sonra; aynı anda ikinci hatırlatıcı yok.
 */
export async function addReminder(
  deps: TaskDeps,
  scope: WorkspaceScope,
  taskId: string,
  input: ReminderInput,
): Promise<Result<Reminder, DomainError>> {
  const allowed = authorize(scope, 'task.update');
  if (!allowed.ok) return allowed;
  const task = await deps.tasks.findById(scope, taskId);
  if (!task) return err(notFound());
  const blocked = await checkWritable(deps, scope, task);
  if (blocked) return err(blocked);

  let remindAt: Date;
  let offsetMinutes: number | null = null;
  if (input.kind === 'relative') {
    if (!task.due) return err(businessRule('BR-REM-001'));
    if (!Number.isInteger(input.offsetMinutes) || input.offsetMinutes < 0) {
      return err(validationError([{ field: 'offsetMinutes', reason: 'invalid' }]));
    }
    if (input.offsetMinutes > MAX_OFFSET_MINUTES) {
      return err(validationError([{ field: 'offsetMinutes', reason: 'too_large' }]));
    }
    offsetMinutes = input.offsetMinutes;
    remindAt = await relativeAt(deps, scope, task, offsetMinutes);
  } else {
    remindAt = new Date(input.remindAt);
    if (Number.isNaN(remindAt.getTime())) {
      return err(validationError([{ field: 'remindAt', reason: 'invalid' }]));
    }
  }
  const now = deps.clock.now();
  if (remindAt.getTime() < now.getTime() + MIN_LEAD_MS) return err(businessRule('BR-REM-002'));
  const existing = (await deps.reminders.forTasks(scope, [task.id])).get(task.id) ?? [];
  if (existing.length >= REMINDERS_PER_TASK) return err(businessRule('BR-REM-002'));
  if (existing.some((r) => r.remindAt.getTime() === remindAt.getTime())) {
    return err(businessRule('BR-REM-002'));
  }
  return ok(
    await deps.reminders.insert(scope, {
      id: deps.newId(),
      taskId: task.id,
      kind: input.kind,
      offsetMinutes,
      remindAt,
      status: 'pending',
      now,
    }),
  );
}

export async function removeReminder(
  deps: TaskDeps,
  scope: WorkspaceScope,
  taskId: string,
  id: string,
): Promise<Result<null, DomainError>> {
  const allowed = authorize(scope, 'task.update');
  if (!allowed.ok) return allowed;
  const task = await deps.tasks.findById(scope, taskId);
  if (!task) return err(notFound());
  const blocked = await checkWritable(deps, scope, task);
  if (blocked) return err(blocked);
  return (await deps.reminders.remove(scope, task.id, id)) ? ok(null) : err(notFound());
}

/**
 * BR-REM-004: son tarih değişince göreli hatırlatıcılar aynı işlemde yeniden hesaplanır; son tarih kaldırılırsa
 * silinir. Mutlak hatırlatıcılar etkilenmez. Yeni anı geçmişte kalan hatırlatıcı gönderilmez (iptal).
 */
export async function recomputeRelative(deps: TaskDeps, scope: WorkspaceScope, task: Task) {
  if (!task.due) {
    await deps.reminders.removeRelative(scope, task.id);
    return;
  }
  const now = deps.clock.now();
  const list = (await deps.reminders.forTasks(scope, [task.id])).get(task.id) ?? [];
  for (const r of list) {
    if (r.kind !== 'relative' || r.offsetMinutes === null) continue;
    if (r.status !== 'pending' && r.status !== 'canceled') continue;
    const at = await relativeAt(deps, scope, task, r.offsetMinutes);
    const status: ReminderStatus =
      task.status === 'done' || at.getTime() <= now.getTime() ? 'canceled' : 'pending';
    await deps.reminders.retime(scope, r.id, at, status, now);
  }
}

/** BR-REC-004: sonraki örneğe göreli hatırlatıcılar kopyalanır (mutlaklar kopyalanmaz). */
export async function copyRelativeReminders(
  deps: TaskDeps,
  scope: WorkspaceScope,
  from: Task,
  to: Task,
) {
  if (!to.due) return;
  const now = deps.clock.now();
  const list = (await deps.reminders.forTasks(scope, [from.id])).get(from.id) ?? [];
  const seen = new Set<number>();
  for (const r of list) {
    if (r.kind !== 'relative' || r.offsetMinutes === null) continue;
    const at = await relativeAt(deps, scope, to, r.offsetMinutes);
    if (seen.has(at.getTime())) continue;
    seen.add(at.getTime());
    await deps.reminders.insert(scope, {
      id: deps.newId(),
      taskId: to.id,
      kind: 'relative',
      offsetMinutes: r.offsetMinutes,
      remindAt: at,
      status: at.getTime() > now.getTime() ? 'pending' : 'canceled',
      now,
    });
  }
}

/** Hatırlatıcı dağıtımının bağımlılıkları (BR-REM-005); kullanıcının çalışma alanlarına göre görevleri okur. */
export type DispatchDeps = {
  clock: Clock;
  newId: () => string;
  due(userId: string, now: Date): Promise<(Reminder & { workspaceId: string })[]>;
  transition(id: string, status: Exclude<ReminderStatus, 'pending'>, now: Date): Promise<boolean>;
  /** Hatırlatıcının görevi ve görevin hâlâ etkin olup olmadığı (çöpte, arşivde, tamamlanmış veya projesi arşivli değil). */
  task(workspaceId: string, taskId: string): Promise<{ title: string; active: boolean } | null>;
  notify(n: {
    id: string;
    userId: string;
    workspaceId: string;
    taskId: string;
    title: string;
    remindAt: Date;
    late: boolean;
    reminderId: string;
    now: Date;
  }): Promise<boolean>;
  /** BR-NOTIF-004: kullanıcı hatırlatıcı bildirimlerini kapattıysa false. */
  enabled: boolean;
};

/**
 * BR-REM-005 / D-053: kullanıcının zamanı gelmiş hatırlatıcıları bildirime dönüştürülür (uygulama açıkken, bildirim
 * sayacı yoklanırken). Durum geçişi koşulludur (`pending → sent`); yalnızca geçişi başaran istek bildirim oluşturur,
 * `dedupe_key` ayrıca korur (BR-NOTIF-002). 15 dakikadan fazla gecikme "gecikmeli", 24 saatten eskisi `skipped`.
 * Görev artık etkin değilse (BR-REM-003; ör. projesi sonradan arşivlendi) hatırlatıcı iptal edilir.
 */
export async function dispatchDueReminders(
  deps: DispatchDeps,
  userId: string,
): Promise<{ sent: number; skipped: number; canceled: number }> {
  const now = deps.clock.now();
  const result = { sent: 0, skipped: 0, canceled: 0 };
  for (const reminder of await deps.due(userId, now)) {
    const task = await deps.task(reminder.workspaceId, reminder.taskId);
    if (!task?.active) {
      if (await deps.transition(reminder.id, 'canceled', now)) result.canceled++;
      continue;
    }
    const outcome = dispatchOutcome(reminder.remindAt, now);
    if (outcome === 'skip' || !deps.enabled) {
      if (await deps.transition(reminder.id, 'skipped', now)) result.skipped++;
      continue;
    }
    if (!(await deps.transition(reminder.id, 'sent', now))) continue;
    await deps.notify({
      id: deps.newId(),
      userId,
      workspaceId: reminder.workspaceId,
      taskId: reminder.taskId,
      title: task.title,
      remindAt: reminder.remindAt,
      late: outcome === 'late',
      reminderId: reminder.id,
      now,
    });
    result.sent++;
  }
  return result;
}
