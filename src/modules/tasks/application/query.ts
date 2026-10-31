import type { TaskFilter, ViewSettings, ViewType } from '@/modules/views';
import { authorize, type WorkspaceScope } from '@/modules/workspaces';
import type { DomainError } from '@/shared/kernel/errors';
import { ok, type Result } from '@/shared/kernel/result';
import { dueGroup, isUpcoming } from '../domain/schedule';
import { OPEN_STATUSES, TASK_STATUSES, type Task, type TaskStatus } from '../domain/task';
import { summarize, type TaskSummary } from './organize';
import type { ProjectRef } from './ports';
import type { TaskDeps } from './tasks';

export type TaskQueryResult = {
  items: TaskSummary[];
  /** BR-VIEW-001: artık var olmayan proje/etiket koşulları yok sayıldı ("Bazı filtreler artık geçerli değil"). */
  ignored: ('projectId' | 'tagId')[];
};

/** Arama ve basit metin filtresi için Türkçe duyarsız karşılaştırma (BR-SRCH-001 ile aynı yaklaşım). */
const fold = (text: string) =>
  text.toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/\p{M}/gu, '');

const PRIORITY_ORDER = (t: Task) => -t.priority;
const DUE_ORDER = (t: Task) => (t.due ? (t.due.at?.toISOString() ?? `${t.due.date}T99`) : '￿');

/** FR-VIEW-05: manuel (konum), son tarih, öncelik, oluşturma, başlık. Eşitlikte konum sırası korunur. */
function sortTasks(tasks: Task[], sort: ViewSettings['sort']): Task[] {
  if (sort === 'manual') return tasks;
  const key: Record<Exclude<ViewSettings['sort'], 'manual'>, (t: Task) => string | number> = {
    due: DUE_ORDER,
    priority: PRIORITY_ORDER,
    created: (t) => t.createdAt.getTime(),
    title: (t) => fold(t.title),
  };
  const by = key[sort];
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      const x = by(a.task);
      const y = by(b.task);
      if (x < y) return -1;
      if (x > y) return 1;
      return a.index - b.index;
    })
    .map(({ task }) => task);
}

/**
 * Görev görünümleri (FR-VIEW-01/02/04/05, BR-VIEW-002): liste ve pano aynı `TaskFilter` ile aynı sorguyu
 * kullanır. Varsayılan kapsam Görevlerim ile aynıdır (arşivlenmemiş projeler, Inbox dahil); arşivli projenin
 * görevleri yalnızca "arşivi dahil et" ile veya proje açıkça seçildiğinde döner (BR-PROJ-004.2). Durum filtresi
 * boşsa listede açık görevler, panoda tüm durumlar gösterilir.
 */
export async function queryTasks(
  deps: TaskDeps,
  scope: WorkspaceScope,
  filter: TaskFilter,
  settings: ViewSettings,
  context: {
    today: string;
    weekStart: number;
    viewType: ViewType;
    /** Durum filtresi boşken kullanılacak durumlar (ör. proje listesi Figma 4:67132: açık + tamamlandı). */
    defaultStatuses?: readonly TaskStatus[] | undefined;
  },
): Promise<Result<TaskQueryResult, DomainError>> {
  const allowed = authorize(scope, 'task.read');
  if (!allowed.ok) return allowed;
  const ignored: TaskQueryResult['ignored'] = [];

  const active = await deps.projects.listActive(scope);
  const known = new Map<string, ProjectRef>(active.map((p) => [p.id, p]));
  if (filter.includeArchived || filter.projectId.length) {
    for (const p of await deps.projects.repo.list(scope, { includeArchived: true })) {
      known.set(p.id, {
        id: p.id,
        name: p.name,
        kind: p.kind,
        color: p.color,
        archived: !!p.archivedAt,
      });
    }
  }
  let projectIds: string[];
  if (filter.projectId.length) {
    projectIds = filter.projectId.filter((id) => known.has(id));
    if (projectIds.length < filter.projectId.length) ignored.push('projectId');
    // Tüm seçili projeler silinmişse koşul yok sayılır (BR-VIEW-001).
    if (projectIds.length === 0) projectIds = active.map((p) => p.id);
  } else {
    projectIds = [...known.values()]
      .filter((p) => filter.includeArchived || !p.archived)
      .map((p) => p.id);
  }

  const statuses = filter.status.length
    ? filter.status
    : context.defaultStatuses
      ? context.defaultStatuses
      : context.viewType === 'board'
        ? TASK_STATUSES
        : OPEN_STATUSES;
  let tasks = await deps.tasks.query(scope, {
    projectIds,
    statuses,
    priorities: filter.priority,
    includeArchived: filter.includeArchived,
    // D-100: takvimde alt görevler de tarihleriyle görünür.
    topLevelOnly: context.viewType !== 'calendar',
  });

  if (filter.tagId.length) {
    const existing = await deps.tags.existing(scope, filter.tagId);
    const tagIds = filter.tagId.filter((id) => existing.has(id));
    if (tagIds.length < filter.tagId.length) ignored.push('tagId');
    if (tagIds.length) {
      const matching = await deps.tags.taskIdsWithTags(scope, tagIds, filter.tagMode);
      tasks = tasks.filter((t) => matching.has(t.id));
    }
  }

  const now = deps.clock.now();
  const dueContext = { today: context.today, weekStart: context.weekStart, now };
  if (filter.due) {
    const due = filter.due;
    tasks = tasks.filter((t) => {
      if (due === 'none') return !t.due;
      if (due === 'any') return !!t.due;
      if (!t.due) return false;
      if (due === 'next7') return isUpcoming(t.due.date, context.today);
      return dueGroup(t.due, dueContext) === due;
    });
  }
  if (filter.dueFrom) tasks = tasks.filter((t) => t.due && t.due.date >= filter.dueFrom!);
  if (filter.dueTo) tasks = tasks.filter((t) => t.due && t.due.date <= filter.dueTo!);
  if (filter.q) {
    const needle = fold(filter.q);
    tasks = tasks.filter(
      (t) => fold(t.title).includes(needle) || fold(t.description ?? '').includes(needle),
    );
  }

  return ok({
    items: await summarize(deps, scope, sortTasks(tasks, settings.sort), known),
    ignored,
  });
}
