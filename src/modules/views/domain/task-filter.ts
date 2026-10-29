import { z } from 'zod';

/**
 * `TaskFilter` v1 (API_CONTRACTS §6.2, BR-VIEW-001/002): liste ve pano aynı filtre tanımını kullanır. Sorgu
 * parametreleri (URL) ile kayıtlı görünümün JSON'u aynı şemadan geçer. Sürüm alanı ileride şema değişirse
 * eski kayıtların dönüştürülmesi içindir.
 */
export const TASK_FILTER_VERSION = 1;

export const VIEW_TYPES = ['list', 'board', 'calendar'] as const;
export type ViewType = (typeof VIEW_TYPES)[number];

/** FR-VIEW-05 */
export const SORT_KEYS = ['manual', 'due', 'priority', 'created', 'title'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/** FR-VIEW-01 */
export const GROUP_KEYS = ['none', 'date', 'priority', 'status', 'project'] as const;
export type GroupKey = (typeof GROUP_KEYS)[number];

export const DUE_FILTERS = ['overdue', 'today', 'tomorrow', 'next7', 'none', 'any'] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

const Uuid = z.string().uuid();
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const TaskFilterSchema = z.strictObject({
  v: z.literal(TASK_FILTER_VERSION).default(TASK_FILTER_VERSION),
  projectId: z.array(Uuid).max(100).default([]),
  /** Boşsa görünümün varsayılanı: listede açık durumlar, panoda tümü. */
  status: z
    .array(z.enum(['todo', 'in_progress', 'done']))
    .max(3)
    .default([]),
  priority: z
    .array(z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]))
    .max(4)
    .default([]),
  tagId: z.array(Uuid).max(50).default([]),
  tagMode: z.enum(['any', 'all']).default('any'),
  due: z.enum(DUE_FILTERS).optional(),
  dueFrom: IsoDate.optional(),
  dueTo: IsoDate.optional(),
  includeArchived: z.boolean().default(false),
  q: z.string().trim().max(200).optional(),
});
export type TaskFilter = z.infer<typeof TaskFilterSchema>;

export const ViewSettingsSchema = z.strictObject({
  sort: z.enum(SORT_KEYS).default('manual'),
  groupBy: z.enum(GROUP_KEYS).default('none'),
});
export type ViewSettings = z.infer<typeof ViewSettingsSchema>;

export const EMPTY_FILTER: TaskFilter = TaskFilterSchema.parse({});

const ARRAY_KEYS = ['projectId', 'status', 'priority', 'tagId'] as const;

/**
 * URL sorgu parametrelerinden filtre (USER_FLOWS §1.3: filtreler URL'de saklanır). Bilinmeyen parametreler
 * (`view`, `task` gibi sayfa durumu) yok sayılır; geçersiz değer doğrulama hatası döner.
 */
export function parseTaskFilter(params: URLSearchParams) {
  const raw: Record<string, unknown> = {};
  for (const key of ARRAY_KEYS) {
    const values = params
      .getAll(key)
      .flatMap((v) => v.split(','))
      .filter(Boolean);
    if (values.length) raw[key] = key === 'priority' ? values.map(Number) : values;
  }
  for (const key of ['tagMode', 'due', 'dueFrom', 'dueTo', 'q'] as const) {
    const value = params.get(key);
    if (value) raw[key] = value;
  }
  if (params.get('includeArchived') === 'true') raw.includeArchived = true;
  const settings: Record<string, unknown> = {};
  for (const key of ['sort', 'groupBy'] as const) {
    const value = params.get(key);
    if (value) settings[key] = value;
  }
  return {
    filter: TaskFilterSchema.safeParse(raw),
    settings: ViewSettingsSchema.safeParse(settings),
  };
}

/** Filtreyi URL parametrelerine çevirir; varsayılan değerler yazılmaz (kısa ve paylaşılabilir adresler). */
export function taskFilterToParams(filter: TaskFilter, settings?: Partial<ViewSettings>) {
  const params = new URLSearchParams();
  for (const key of ARRAY_KEYS) for (const value of filter[key]) params.append(key, String(value));
  if (filter.tagId.length && filter.tagMode !== 'any') params.set('tagMode', filter.tagMode);
  if (filter.due) params.set('due', filter.due);
  if (filter.dueFrom) params.set('dueFrom', filter.dueFrom);
  if (filter.dueTo) params.set('dueTo', filter.dueTo);
  if (filter.includeArchived) params.set('includeArchived', 'true');
  if (filter.q) params.set('q', filter.q);
  if (settings?.sort && settings.sort !== 'manual') params.set('sort', settings.sort);
  if (settings?.groupBy && settings.groupBy !== 'none') params.set('groupBy', settings.groupBy);
  return params;
}

/** Etkin (varsayılandan farklı) koşul sayısı: filtre düğmesindeki rozet için. */
export function activeConditionCount(filter: TaskFilter): number {
  return (
    (filter.projectId.length ? 1 : 0) +
    (filter.status.length ? 1 : 0) +
    (filter.priority.length ? 1 : 0) +
    (filter.tagId.length ? 1 : 0) +
    (filter.due || filter.dueFrom || filter.dueTo ? 1 : 0) +
    (filter.includeArchived ? 1 : 0) +
    (filter.q ? 1 : 0)
  );
}
