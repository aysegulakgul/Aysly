import {
  EMPTY_FILTER,
  parseTaskFilter,
  type TaskFilter,
  type ViewSettings,
  type ViewType,
} from '@/modules/views';

export type PageSearchParams = Record<string, string | string[] | undefined>;

/**
 * Sayfa adresinden görünüm durumu (USER_FLOWS §1.3): filtre, sıralama, gruplama, `view=list|board` ve açık görev.
 * Geçersiz parametreler yok sayılır (sayfa hata vermez; API aynı değerleri 400 ile reddeder).
 */
export function readViewParams(
  query: PageSearchParams,
  fallback?: { filter: TaskFilter; settings: ViewSettings; viewType: ViewType },
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const v of Array.isArray(value) ? value : value ? [value] : []) params.append(key, v);
  }
  const hasFilter = [...params.keys()].some((k) => k !== 'view' && k !== 'task');
  const parsed = parseTaskFilter(params);
  const filter =
    !hasFilter && fallback
      ? fallback.filter
      : parsed.filter.success
        ? parsed.filter.data
        : EMPTY_FILTER;
  const settings =
    !hasFilter && fallback
      ? fallback.settings
      : parsed.settings.success
        ? parsed.settings.data
        : { sort: 'manual' as const, groupBy: 'none' as const };
  const view = params.get('view');
  const viewType: ViewType =
    view === 'board' || view === 'list' ? view : (fallback?.viewType ?? 'list');
  return { filter, settings, viewType, task: params.get('task') ?? undefined };
}
