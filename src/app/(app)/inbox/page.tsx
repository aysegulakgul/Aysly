import { getTranslations } from 'next-intl/server';
import { findInboxTasks, findTaskDetail } from '@/modules/tasks';
import { getPersonalScope, getViewer } from '../../viewer';
import { PageFrame } from '../page-frame';
import { QuickCapture } from '../tasks/quick-capture';
import { buildTaskContext } from '../tasks/task-context.server';
import { TaskDetailPanel } from '../tasks/task-detail';
import { InboxList } from './inbox-list';

/**
 * Inbox (Figma 4:66650 masaüstü, 4:68036 mobil): hızlı ekleme ve "İşlenecekler". `?task=` görev detay panelini
 * açar (4:66875). Çoklu seçim ("Seç") toplu işlemlerle birlikte gelir.
 */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string; task?: string }>;
}) {
  const [viewer, scope, t, query] = await Promise.all([
    getViewer(),
    getPersonalScope(),
    getTranslations('tasks.inbox'),
    searchParams,
  ]);
  if (!viewer || !scope) return null;
  const [tasks, context, detail] = await Promise.all([
    findInboxTasks(scope),
    buildTaskContext(viewer, scope),
    query.task ? findTaskDetail(scope, query.task) : null,
  ]);
  return (
    <PageFrame title={t('title')}>
      <div className="flex w-full flex-col gap-2">
        <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
        <p className="text-sm text-text-secondary">{t('subtitle', { count: tasks.length })}</p>
      </div>
      <QuickCapture context={context} autoFocus={query.add === '1'} />
      <InboxList tasks={tasks} context={context} />
      {query.task ? <TaskDetailPanel detail={detail} context={context} /> : null}
    </PageFrame>
  );
}
