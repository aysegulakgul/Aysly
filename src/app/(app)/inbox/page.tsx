import { getTranslations } from 'next-intl/server';
import { findInboxTasks } from '@/modules/tasks';
import { getPersonalScope, getViewer } from '../../viewer';
import { PageFrame } from '../page-frame';
import { QuickCapture } from '../tasks/quick-capture';
import type { TaskUiContext } from '../tasks/task-context';
import { InboxList } from './inbox-list';

/**
 * Inbox (Figma 4:66650 masaüstü, 4:68036 mobil). Hızlı ekleme ve "İşlenecekler" listesi. Projeye taşıma, çoklu
 * seçim ve "Tarih ver" satır eylemleri taşıma ve toplu işlemlerle birlikte (Faz 4, 3–4. bölüm) gelir.
 */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>;
}) {
  const [viewer, scope, t, query] = await Promise.all([
    getViewer(),
    getPersonalScope(),
    getTranslations('tasks.inbox'),
    searchParams,
  ]);
  if (!viewer || !scope) return null;
  const tasks = await findInboxTasks(scope);
  const context: TaskUiContext = {
    workspaceId: scope.workspaceId,
    timezone: viewer.preferences.timezone,
    weekStart: viewer.preferences.weekStart,
    timeFormat: viewer.preferences.timeFormat,
  };
  return (
    <PageFrame title={t('title')}>
      <div className="flex w-full flex-col gap-2">
        <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
        <p className="text-sm text-text-secondary">{t('subtitle', { count: tasks.length })}</p>
      </div>
      <QuickCapture context={context} autoFocus={query.add === '1'} />
      <InboxList tasks={tasks} context={context} />
    </PageFrame>
  );
}
