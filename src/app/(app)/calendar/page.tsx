import { getTranslations } from 'next-intl/server';
import { findActiveProjects } from '@/modules/projects';
import { findManagedTags } from '@/modules/tags';
import { findTaskDetail, findTaskList } from '@/modules/tasks';
import { getPersonalScope, getViewer } from '../../viewer';
import { PageFrame } from '../page-frame';
import { todayIn } from '../tasks/dates';
import { buildTaskContext } from '../tasks/task-context.server';
import { TaskDetailPanel } from '../tasks/task-detail';
import { readViewParams, type PageSearchParams } from '../views/view-params';
import { Calendar } from './calendar';
import { CalendarFilters } from './calendar-filters';

const MODES = ['month', 'week', 'day'] as const;

/**
 * Takvim (Figma 4:67372, 4:68640; FR-CAL-01..04, 06). Görünüm (`cal`) ve tarih (`date`) URL'de; proje ve etiket
 * filtreleri `TaskFilter` ile (BR-VIEW-002). Varsayılan kapsam açık görevlerdir.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const [viewer, scope, t, query] = await Promise.all([
    getViewer(),
    getPersonalScope(),
    getTranslations('calendar'),
    searchParams,
  ]);
  if (!viewer || !scope) return null;
  const { filter, settings, task } = readViewParams(query);
  const today = todayIn(viewer.preferences.timezone, new Date());
  const rawDate = typeof query.date === 'string' ? query.date : '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;
  const mode = MODES.find((m) => m === query.cal) ?? null;
  const [list, context, projects, tags, detail] = await Promise.all([
    findTaskList(scope, viewer.preferences, filter, settings, 'calendar'),
    buildTaskContext(viewer, scope),
    findActiveProjects(scope),
    findManagedTags(scope),
    task ? findTaskDetail(scope, task) : null,
  ]);
  return (
    <PageFrame title={t('title')} wide>
      <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
      <Calendar
        tasks={list.tasks}
        context={context}
        mode={mode}
        date={date}
        filters={<CalendarFilters filter={filter} projects={projects} tags={tags} />}
      />
      {task ? <TaskDetailPanel detail={detail} context={context} /> : null}
    </PageFrame>
  );
}
