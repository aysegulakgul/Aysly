/** Faz 4'te çalışan Bugün bölümleri; Projeler ve Hedefler Faz 7'de eklenir (D-080). */
export const AVAILABLE_WIDGETS = ['today', 'overdue', 'upcoming', 'priority'] as const;
export type WidgetId = (typeof AVAILABLE_WIDGETS)[number];
