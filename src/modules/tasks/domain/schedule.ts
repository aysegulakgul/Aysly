import type { Due } from './due';

export const DUE_GROUPS = ['overdue', 'today', 'tomorrow', 'thisWeek', 'later', 'none'] as const;
export type DueGroup = (typeof DUE_GROUPS)[number];

const DAY = 86_400_000;
const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** Bu haftanın son günü (kullanıcının hafta başlangıcına göre; 0 = Pazar … 6 = Cumartesi). */
export function endOfWeek(today: string, weekStart: number): string {
  const daysToEnd = (weekStart + 6 - weekdayOf(today) + 7) % 7;
  return shift(today, daysToEnd);
}

/**
 * BR-DATE-003 / BR-DATE-004: Görevlerim'in son tarih grupları. "Bugün" kullanıcının saat dilimindeki takvim
 * günüdür (`today`). Tüm gün görev `due_date < bugün` ise, saatli görev `due_at < şimdi` ise gecikmiştir.
 * Tarihsiz görevler ayrı gruptadır.
 */
export function dueGroup(
  due: Due | null,
  context: { today: string; now: Date; weekStart: number },
): DueGroup {
  if (!due) return 'none';
  const overdue = due.at ? due.at.getTime() < context.now.getTime() : due.date < context.today;
  if (overdue) return 'overdue';
  if (due.date === context.today) return 'today';
  if (due.date === shift(context.today, 1)) return 'tomorrow';
  if (due.date <= endOfWeek(context.today, context.weekStart)) return 'thisWeek';
  return 'later';
}

/** BR-DATE-003: kullanıcının saat dilimindeki bugünün tarihi (`YYYY-MM-DD`). */
export function todayIn(timeZone: string, now: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** BR-DATE-003: "Yaklaşan" bugünden sonraki 7 gündür (yarından itibaren, 7. gün dahil). */
export function isUpcoming(dueDate: string, today: string): boolean {
  return dueDate > today && dueDate <= shift(today, 7);
}
