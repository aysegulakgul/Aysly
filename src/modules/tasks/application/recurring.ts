import { generateKeyBetween } from 'fractional-indexing';
import type { WorkspaceScope } from '@/modules/workspaces';
import { businessRule, validationError, type DomainError } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import { prepareDue, type Due } from '../domain/due';
import {
  addDays,
  formatRule,
  nextOccurrence,
  parseRule,
  type Recurrence,
  type RecurrenceMode,
} from '../domain/recurrence';
import { todayIn } from '../domain/schedule';
import type { Task } from '../domain/task';
import type { TaskDeps } from './ports';
import { copyRelativeReminders } from './reminders';

export type RecurrenceInput = { rule: string; mode?: RecurrenceMode | undefined };

/**
 * BR-REC-001/003: tekrar kuralı yalnızca son tarihli üst düzey göreve eklenir; desteklenmeyen RRULE reddedilir.
 * Mevcut seride kural değişince seri kimliği ve sıra korunur ("bu ve sonraki örnekler", BR-REC-006); planlanan
 * tarih (anchor) görevin son tarihi olur.
 */
export function prepareRecurrence(
  input: RecurrenceInput,
  context: {
    due: Due | null;
    parentTaskId: string | null;
    current: Recurrence | null;
    newId: () => string;
  },
): Result<Recurrence, DomainError> {
  if (!context.due || context.parentTaskId) return err(businessRule('BR-REC-001'));
  const parsed = parseRule(input.rule);
  if (!parsed.ok) return err(validationError([parsed.error]));
  return ok({
    rule: formatRule(parsed.value),
    mode: input.mode ?? context.current?.mode ?? 'fixed_schedule',
    seriesId: context.current?.seriesId ?? context.newId(),
    anchor: context.due.date,
    index: context.current?.index ?? 1,
    generatedFrom: context.current?.generatedFrom ?? null,
  });
}

/**
 * BR-REC-002/004: tekrarlayan örnek tamamlanınca sonraki örnek aynı işlemde oluşturulur. Kopyalanan: başlık,
 * açıklama, öncelik, proje, etiketler, saat ve saat dilimi, göreli hatırlatıcılar, alt görevler (açık olarak);
 * başlangıç ile son tarih arasındaki fark korunur. Durum her zaman Yapılacak. Bu tamamlamayla daha önce üretilmiş
 * bir örnek varsa (tamamlama geri alınıp örnek korunduysa, BR-REC-007) yenisi üretilmez. Seri bittiyse null.
 */
export async function generateNextOccurrence(
  deps: TaskDeps,
  scope: WorkspaceScope,
  completed: Task,
): Promise<Task | null> {
  const recurrence = completed.recurrence;
  if (!recurrence || !completed.due) return null;
  if (await deps.tasks.findGeneratedFrom(scope, completed.id)) return null;
  const parsed = parseRule(recurrence.rule);
  if (!parsed.ok) return null;
  const prefs = await deps.calendar.of(scope.userId);
  const now = deps.clock.now();
  const date = nextOccurrence(parsed.value, recurrence.mode, {
    anchor: recurrence.anchor,
    index: recurrence.index,
    today: todayIn(prefs.timezone, now),
  });
  if (!date) return null;

  // BR-DATE-006: saatli seri kendi saat diliminde aynı yerel saatte kalır.
  const { due } = prepareDue({
    date,
    time: completed.due.time,
    timezone: completed.due.timezone,
  });
  const shift = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${completed.due.date}T00:00:00Z`)) / 86_400_000,
  );
  const last = await deps.tasks.lastPosition(scope, completed.projectId, null);
  const next = await deps.tasks.insert(scope, {
    id: deps.newId(),
    projectId: completed.projectId,
    parentTaskId: null,
    title: completed.title,
    description: completed.description,
    priority: completed.priority,
    startDate: completed.startDate ? addDays(completed.startDate, shift) : null,
    due,
    position: generateKeyBetween(last, null),
    recurrence: {
      ...recurrence,
      anchor: date,
      index: recurrence.index + 1,
      generatedFrom: completed.id,
    },
    createdBy: scope.userId,
    now,
  });
  const tags = (await deps.tags.forTasks(scope, [completed.id])).get(completed.id) ?? [];
  if (tags.length) {
    await deps.tags.replace(
      scope,
      next.id,
      tags.map((t) => t.name),
      now,
    );
  }
  let lastSub: string | null = null;
  for (const sub of await deps.tasks.listSubtasks(scope, completed.id)) {
    if (sub.archivedAt) continue;
    lastSub = generateKeyBetween(lastSub, null);
    await deps.tasks.insert(scope, {
      id: deps.newId(),
      projectId: completed.projectId,
      parentTaskId: next.id,
      title: sub.title,
      description: sub.description,
      priority: sub.priority,
      startDate: null,
      due: null,
      position: lastSub,
      createdBy: scope.userId,
      now,
    });
  }
  await copyRelativeReminders(deps, scope, completed, next);
  return next;
}

/**
 * BR-REC-007: tamamlama geri alınınca o tamamlamayla üretilen sonraki örnek hiç değiştirilmemişse (version = 1)
 * kalıcı silinir; değiştirilmişse korunur ve kullanıcı bilgilendirilir.
 */
export async function undoGeneratedOccurrence(
  deps: TaskDeps,
  scope: WorkspaceScope,
  reopened: Task,
): Promise<{ removedNext: boolean; keptNext: boolean }> {
  const generated = await deps.tasks.findGeneratedFrom(scope, reopened.id);
  if (!generated) return { removedNext: false, keptNext: false };
  if (generated.version === 1) {
    await deps.tasks.hardDelete(scope, generated.id);
    return { removedNext: true, keptNext: false };
  }
  return { removedNext: false, keptNext: true };
}
