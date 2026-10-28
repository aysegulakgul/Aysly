import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { findMyTasks, findTaskDetail } from '@/modules/tasks';
import { Icon } from '@/ui/components/icon';
import { getPersonalScope, getViewer } from '../../viewer';
import { PageFrame } from '../page-frame';
import { buildTaskContext } from '../tasks/task-context.server';
import { TaskDetailPanel } from '../tasks/task-detail';
import { MyTaskGroups } from './my-task-groups';

/**
 * Görevlerim (Figma 4:66732): son tarihe göre gruplu açık görevler (BR-INBOX-004, BR-DATE-003/004).
 * Pano ve Takvim sekmeleri, filtre ve gruplama seçimi ilgili fazlarda gelir (Faz 5–6).
 */
export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>;
}) {
  const [viewer, scope, t, tShell, query] = await Promise.all([
    getViewer(),
    getPersonalScope(),
    getTranslations('tasks.myTasks'),
    getTranslations('shell'),
    searchParams,
  ]);
  if (!viewer || !scope) return null;
  const [groups, context, detail] = await Promise.all([
    findMyTasks(scope, viewer.preferences),
    buildTaskContext(viewer, scope),
    query.task ? findTaskDetail(scope, query.task) : null,
  ]);
  const count = groups.reduce((n, g) => n + g.tasks.length, 0);
  return (
    <PageFrame title={t('title')}>
      <div className="flex w-full items-start gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
          <p className="text-sm text-text-secondary">{t('subtitle', { count })}</p>
        </div>
        {/* BR-INBOX-001: bağlamsız ekleme Inbox'a gider. */}
        <Link
          href="/inbox?add=1"
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-base font-medium text-on-primary"
        >
          <Icon name="plus" />
          {tShell('addTask')}
        </Link>
      </div>
      <MyTaskGroups groups={groups} context={context} />
      {query.task ? <TaskDetailPanel detail={detail} context={context} /> : null}
    </PageFrame>
  );
}
