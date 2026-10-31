import { addDays } from '../tasks/dates';

/** Tarih gruplarında bölümün ekleme tarihi (bugün, yarın); diğerleri tarihsiz eklenir. */
export function sectionDueDate(group: string, today: string): string | undefined {
  if (group === 'today' || group === 'overdue') return today;
  if (group === 'tomorrow') return addDays(today, 1);
  return undefined;
}
