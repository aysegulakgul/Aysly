import { getLocale, getTranslations } from 'next-intl/server';
import { findTaskDetail } from '@/modules/tasks';
import { getDashboard, getPersonalScope, getViewer } from '../../viewer';
import { PageFrame } from '../page-frame';
import { addDays, longDay } from '../tasks/dates';
import { buildTaskContext } from '../tasks/task-context.server';
import { TaskDetailPanel } from '../tasks/task-detail';
import { UpcomingList } from './upcoming-list';

/**
 * Yaklaşanlar (Figma 4:67785 masaüstü, 4:69086 mobil): bugünden sonraki 7 gün, gün gün (BR-DATE-003, FR-DASH-03).
 * Filtre çipleri, "Görünümü kaydet" ve Pano/Takvim sekmeleri kayıtlı görünümlerle (Faz 5) gelir.
 */
export default async function UpcomingPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>;
}) {
  const [viewer, scope, locale, t, query] = await Promise.all([
    getViewer(),
    getPersonalScope(),
    getLocale(),
    getTranslations('upcoming'),
    searchParams,
  ]);
  if (!viewer || !scope) return null;
  const [context, data, detail] = await Promise.all([
    buildTaskContext(viewer, scope),
    getDashboard(),
    query.task ? findTaskDetail(scope, query.task) : null,
  ]);
  const tasks = data?.upcoming ?? [];
  const range = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatRange(
    Date.parse(`${addDays(context.today, 1)}T00:00:00Z`),
    Date.parse(`${addDays(context.today, 7)}T00:00:00Z`),
  );
  const days = [...new Set(tasks.map((task) => task.due!.date))].map((date) => ({
    date,
    // Figma "16 Ekim Cuma": yıl olmadan gün, ay ve gün adı
    label: longDay(date, locale).replace(/\s\d{4}/, ''),
    tasks: tasks.filter((task) => task.due!.date === date),
  }));
  return (
    <PageFrame title={t('title')}>
      <div className="flex w-full flex-col gap-2">
        <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
        <p className="text-sm text-text-secondary">
          {t('subtitle', { range, count: tasks.length })}
        </p>
      </div>
      <UpcomingList days={days} context={context} />
      <p className="text-sm text-text-secondary">{t('footer')}</p>
      {query.task ? <TaskDetailPanel detail={detail} context={context} /> : null}
    </PageFrame>
  );
}
