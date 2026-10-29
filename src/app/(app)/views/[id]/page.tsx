import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { findActiveProjects } from '@/modules/projects';
import { findManagedTags } from '@/modules/tags';
import { findTaskDetail, findTaskList } from '@/modules/tasks';
import { findView } from '@/modules/views';
import { getPersonalScope, getViewer } from '../../../viewer';
import { PageFrame } from '../../page-frame';
import { buildTaskContext } from '../../tasks/task-context.server';
import { TaskDetailPanel } from '../../tasks/task-detail';
import { TaskViewSection } from '../task-view';
import { readViewParams, type PageSearchParams } from '../view-params';
import { ViewHeader } from './view-header';

/**
 * Kayıtlı görünüm (FR-VIEW-07, BR-VIEW-001): kaydedilen filtre, sıralama ve tür ile açılır; adresteki değişiklikler
 * "Değişiklikleri kaydet" ile görünüme yazılır. Silinmiş proje/etiket koşulları yok sayılır ve uyarı gösterilir.
 */
export default async function SavedViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const [viewer, scope, t, { id }, query] = await Promise.all([
    getViewer(),
    getPersonalScope(),
    getTranslations('shell'),
    params,
    searchParams,
  ]);
  if (!viewer || !scope) return null;
  const view = await findView(scope, id);
  if (!view) notFound();
  const { filter, settings, viewType, task } = readViewParams(query, {
    filter: view.filter,
    settings: { sort: view.sort, groupBy: view.groupBy },
    viewType: view.viewType,
  });
  const [list, context, projects, tags, detail] = await Promise.all([
    findTaskList(scope, viewer.preferences, filter, settings, viewType),
    buildTaskContext(viewer, scope),
    findActiveProjects(scope),
    findManagedTags(scope),
    task ? findTaskDetail(scope, task) : null,
  ]);
  const changed =
    JSON.stringify([filter, settings, viewType]) !==
    JSON.stringify([view.filter, { sort: view.sort, groupBy: view.groupBy }, view.viewType]);
  return (
    <PageFrame title={`${t('savedViews')} / ${view.name}`}>
      <ViewHeader
        view={{ id: view.id, name: view.name, version: view.version }}
        workspaceId={scope.workspaceId}
        changes={
          changed ? { filter, sort: settings.sort, groupBy: settings.groupBy, viewType } : null
        }
        count={list.tasks.length}
      />
      <TaskViewSection
        tasks={list.tasks}
        ignored={list.ignored}
        filter={filter}
        settings={settings}
        viewType={viewType}
        task={task}
        context={context}
        options={{ projects, tags }}
      />
      {task ? <TaskDetailPanel detail={detail} context={context} /> : null}
    </PageFrame>
  );
}
