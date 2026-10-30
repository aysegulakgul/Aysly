/** Bugün bölümleri (FR-DASH-01..04, 06, 07); Projeler ve Hedefler Faz 7'de eklendi. */
export const AVAILABLE_WIDGETS = [
  'today',
  'overdue',
  'upcoming',
  'priority',
  'projects',
  'goals',
] as const;
export const TASK_WIDGETS = ['today', 'overdue', 'upcoming', 'priority'] as const;
export type WidgetId = (typeof AVAILABLE_WIDGETS)[number];
