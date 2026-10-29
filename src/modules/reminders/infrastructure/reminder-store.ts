import { and, asc, eq, inArray, lte, gt, sql } from 'drizzle-orm';
import type { WorkspaceScope } from '@/modules/workspaces';
import type { DbExecutor } from '@/shared/db/client';
import { isUuid } from '@/shared/kernel/id';
import type { Reminder, ReminderKind, ReminderStatus } from '../domain/reminder';
import { reminders } from './schema';

type Row = typeof reminders.$inferSelect;
const toReminder = (row: Row): Reminder => ({
  id: row.id,
  taskId: row.taskId,
  kind: row.kind as ReminderKind,
  offsetMinutes: row.offsetMinutes,
  remindAt: row.remindAt,
  status: row.status as ReminderStatus,
  sentAt: row.sentAt,
});
const inScope = (scope: WorkspaceScope) => eq(reminders.workspaceId, scope.workspaceId);

/** Görevlerin hatırlatıcıları, zamana göre sıralı (görev detayı, API_CONTRACTS §8). */
export async function findRemindersForTasks(
  db: DbExecutor,
  scope: WorkspaceScope,
  taskIds: readonly string[],
): Promise<Map<string, Reminder[]>> {
  const result = new Map<string, Reminder[]>();
  if (taskIds.length === 0) return result;
  const rows = await db
    .select()
    .from(reminders)
    .where(and(inScope(scope), inArray(reminders.taskId, [...taskIds])))
    .orderBy(asc(reminders.remindAt));
  for (const row of rows)
    result.set(row.taskId, [...(result.get(row.taskId) ?? []), toReminder(row)]);
  return result;
}

export async function insertReminder(
  db: DbExecutor,
  scope: WorkspaceScope,
  r: {
    id: string;
    taskId: string;
    kind: ReminderKind;
    offsetMinutes: number | null;
    remindAt: Date;
    status: ReminderStatus;
    now: Date;
  },
): Promise<Reminder> {
  const [row] = await db
    .insert(reminders)
    .values({
      id: r.id,
      workspaceId: scope.workspaceId,
      taskId: r.taskId,
      recipientUserId: scope.userId,
      kind: r.kind,
      offsetMinutes: r.offsetMinutes,
      remindAt: r.remindAt,
      status: r.status,
      createdAt: r.now,
      updatedAt: r.now,
    })
    .returning();
  return toReminder(row!);
}

export async function deleteReminder(
  db: DbExecutor,
  scope: WorkspaceScope,
  taskId: string,
  id: string,
): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await db
    .delete(reminders)
    .where(and(inScope(scope), eq(reminders.taskId, taskId), eq(reminders.id, id)))
    .returning({ id: reminders.id });
  return rows.length > 0;
}

export async function updateReminderTime(
  db: DbExecutor,
  scope: WorkspaceScope,
  id: string,
  remindAt: Date,
  status: ReminderStatus,
  now: Date,
): Promise<void> {
  await db
    .update(reminders)
    .set({ remindAt, status, updatedAt: now })
    .where(and(inScope(scope), eq(reminders.id, id)));
}

export async function deleteRelativeReminders(
  db: DbExecutor,
  scope: WorkspaceScope,
  taskId: string,
): Promise<void> {
  await db
    .delete(reminders)
    .where(and(inScope(scope), eq(reminders.taskId, taskId), eq(reminders.kind, 'relative')));
}

/** BR-REM-003: görev tamamlanınca/arşivlenince/çöpe gidince bekleyen hatırlatıcılar iptal olur. */
export async function cancelPendingReminders(
  db: DbExecutor,
  scope: WorkspaceScope,
  taskIds: readonly string[],
  now: Date,
): Promise<void> {
  if (taskIds.length === 0) return;
  await db
    .update(reminders)
    .set({ status: 'canceled', updatedAt: now })
    .where(
      and(inScope(scope), inArray(reminders.taskId, [...taskIds]), eq(reminders.status, 'pending')),
    );
}

/** BR-REM-003: görev geri gelince zamanı hâlâ gelecekte olan iptal edilmiş hatırlatıcılar yeniden bekler. */
export async function reactivateReminders(
  db: DbExecutor,
  scope: WorkspaceScope,
  taskIds: readonly string[],
  now: Date,
): Promise<void> {
  if (taskIds.length === 0) return;
  await db
    .update(reminders)
    .set({ status: 'pending', updatedAt: now })
    .where(
      and(
        inScope(scope),
        inArray(reminders.taskId, [...taskIds]),
        eq(reminders.status, 'canceled'),
        gt(reminders.remindAt, now),
      ),
    );
}

/** Kullanıcının zamanı gelmiş bekleyen hatırlatıcıları (BR-REM-005, D-053: uygulama açıkken yoklamada). */
export async function findDueReminders(
  db: DbExecutor,
  userId: string,
  now: Date,
): Promise<(Reminder & { workspaceId: string })[]> {
  const rows = await db
    .select()
    .from(reminders)
    .where(
      and(
        eq(reminders.recipientUserId, userId),
        eq(reminders.status, 'pending'),
        lte(reminders.remindAt, now),
      ),
    )
    .orderBy(asc(reminders.remindAt))
    .limit(200);
  return rows.map((row) => ({ ...toReminder(row), workspaceId: row.workspaceId }));
}

/**
 * BR-REM-005: koşullu durum geçişi (`pending → sent/skipped/canceled`). Yalnızca geçişi başaran işlem bildirim
 * oluşturur; aynı hatırlatıcıyı paralel işleyen ikinci istek `false` alır.
 */
export async function transitionReminder(
  db: DbExecutor,
  id: string,
  status: Exclude<ReminderStatus, 'pending'>,
  now: Date,
): Promise<boolean> {
  const rows = await db
    .update(reminders)
    .set({
      status,
      updatedAt: now,
      ...(status === 'sent' ? { sentAt: now } : {}),
    })
    .where(and(eq(reminders.id, id), eq(reminders.status, 'pending')))
    .returning({ id: reminders.id });
  return rows.length > 0;
}

/** Görev kopyalanırken (tekrar, BR-REC-004) aynı alandaki bekleyen hatırlatıcı sayısı vb. için toplam. */
export async function countReminders(
  db: DbExecutor,
  scope: WorkspaceScope,
  taskId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(reminders)
    .where(and(inScope(scope), eq(reminders.taskId, taskId)));
  return row?.n ?? 0;
}
