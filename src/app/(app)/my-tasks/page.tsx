import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { findMyTasks, findTaskDetail, type TaskView } from '@/modules/tasks';
import { cn } from '@/ui/cn';
import { getPersonalScope, getViewer } from '../../viewer';
import { PageFrame } from '../page-frame';
import { QuickCapture } from '../tasks/quick-capture';
import { buildTaskContext } from '../tasks/task-context.server';
import { TaskDetailPanel } from '../tasks/task-detail';
import { STATUS_COLOR } from '../tasks/pills';
import { MyTaskTable, type TaskSection } from './my-task-table';
import { sectionDueDate } from './sections';

/**
 * Görevlerim (D-098, D-100): Inbox ile birleşik tek görev ekranı. Hızlı ekleme (BR-INBOX-001: projesiz görev),
 * tarihe ya da projeye göre bölümler (`?group=project`), satır başına atanan, tarih, proje, öncelik, statü ve
 * story point; bölüm başına ekleme ve puan toplamı. `?task=` yan panelde görev detayını açar.
 */
/** D-107: statü bölümleri, ürün sahibinin sırasıyla. */
const STATUS_SECTIONS = ['todo', 'in_progress', 'done', 'on_hold'] as const;

/** D-100: tarih bölümlerinin renk vurgusu. */
const GROUP_COLOR: Record<string, string> = {
  overdue: 'red',
  today: 'blue',
  tomorrow: 'violet',
  thisWeek: 'teal',
  later: 'indigo',
  none: 'slate',
  done: 'green',
};

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string; add?: string; group?: string }>;
}) {
  const [viewer, scope, t, query] = await Promise.all([
    getViewer(),
    getPersonalScope(),
    getTranslations('tasks'),
    searchParams,
  ]);
  if (!viewer || !scope) return null;
  const [groups, context, detail] = await Promise.all([
    findMyTasks(scope, viewer.preferences),
    buildTaskContext(viewer, scope),
    query.task ? findTaskDetail(scope, query.task) : null,
  ]);
  // D-107: varsayılan bölümler statüye göre; tarihe ve projeye göre gruplama sekmelerde.
  const mode = query.group === 'project' ? 'project' : query.group === 'date' ? 'date' : 'status';
  const byProject = mode === 'project';
  const all = groups.flatMap((g) => g.tasks);
  const sections: TaskSection[] =
    mode === 'status'
      ? STATUS_SECTIONS.map((status) => ({
          key: status,
          title: t(`status.${status}`),
          color: STATUS_COLOR[status]!,
          add: status === 'todo' ? {} : { status },
          tasks: all.filter((task: TaskView) => task.status === status),
        }))
      : byProject
        ? context.projects.map((p) => ({
            key: p.id,
            title: p.kind === 'inbox' ? t('table.noProject') : p.name,
            color: p.color,
            add: { projectId: p.id },
            tasks: all.filter((task: TaskView) => task.projectId === p.id),
          }))
        : groups.map((g) => ({
            key: g.group,
            title: t(`groups.${g.group}`),
            color: GROUP_COLOR[g.group] ?? 'slate',
            add: { dueDate: sectionDueDate(g.group, context.today) },
            tasks: g.tasks,
          }));
  const tab = (active: boolean) =>
    cn(
      'flex min-h-9 items-center rounded-sm px-3 text-sm',
      active ? 'bg-support-1 font-medium text-primary' : 'text-text-secondary',
    );
  return (
    <PageFrame title={t('myTasks.title')} wide>
      <div className="flex w-full flex-wrap items-end gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="text-xl font-semibold text-text">{t('myTasks.title')}</h1>
          <p className="text-sm text-text-secondary">
            {t('myTasks.subtitle', { count: all.length })}
          </p>
        </div>
        <nav aria-label={t('table.groupBy')} className="flex gap-1">
          <Link
            href="/my-tasks"
            aria-current={mode === 'status' ? 'page' : undefined}
            className={tab(mode === 'status')}
          >
            {t('table.byStatus')}
          </Link>
          <Link
            href="/my-tasks?group=date"
            aria-current={mode === 'date' ? 'page' : undefined}
            className={tab(mode === 'date')}
          >
            {t('table.byDate')}
          </Link>
          <Link
            href="/my-tasks?group=project"
            aria-current={byProject ? 'page' : undefined}
            className={tab(byProject)}
          >
            {t('table.byProject')}
          </Link>
        </nav>
      </div>
      <QuickCapture context={context} autoFocus={query.add === '1'} />
      <MyTaskTable sections={sections} context={context} />
      {query.task ? <TaskDetailPanel detail={detail} context={context} /> : null}
    </PageFrame>
  );
}
