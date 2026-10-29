import type { ZonedTimeToUtc } from './time';

export const REMINDER_KINDS = ['absolute', 'relative'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];
export type ReminderStatus = 'pending' | 'sent' | 'canceled' | 'skipped';

export type Reminder = {
  id: string;
  taskId: string;
  kind: ReminderKind;
  offsetMinutes: number | null;
  remindAt: Date;
  status: ReminderStatus;
  sentAt: Date | null;
};

export const REMINDERS_PER_TASK = 5; // BR-REM-002
export const MIN_LEAD_MS = 60_000; // BR-REM-002: en az 1 dakika sonra
export const LATE_MS = 15 * 60_000; // BR-REM-005: 15 dakikadan fazla gecikme "gecikmeli"
export const STALE_MS = 24 * 60 * 60_000; // BR-REM-005: 24 saatten eskisi gönderilmez
export const MAX_OFFSET_MINUTES = 60 * 24 * 30;

/** Göreli hatırlatıcının referans anı: saatli görevde `due_at`, tüm gün görevde tercih edilen saat (BR-REM-001). */
export type DueRef = { date: string; at: Date | null };

/**
 * BR-REM-001: göreli hatırlatıcı anı = referans an − ofset. Tüm gün görevlerde referans an, kullanıcının
 * "tüm gün hatırlatıcı saati" tercihinin kullanıcı saat dilimindeki karşılığıdır.
 */
export function relativeRemindAt(
  due: DueRef,
  offsetMinutes: number,
  prefs: { timezone: string; allDayReminderTime: string },
  toUtc: ZonedTimeToUtc,
): Date {
  const reference = due.at ?? toUtc(due.date, prefs.allDayReminderTime.slice(0, 5), prefs.timezone);
  return new Date(reference.getTime() - offsetMinutes * 60_000);
}

/** BR-REM-005: zamanı gelen hatırlatıcının sonucu. */
export function dispatchOutcome(remindAt: Date, now: Date): 'send' | 'late' | 'skip' {
  const age = now.getTime() - remindAt.getTime();
  if (age > STALE_MS) return 'skip';
  return age > LATE_MS ? 'late' : 'send';
}
