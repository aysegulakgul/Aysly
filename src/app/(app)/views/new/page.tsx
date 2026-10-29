import { getTranslations } from 'next-intl/server';
import { findActiveProjects } from '@/modules/projects';
import { findManagedTags } from '@/modules/tags';
import { findTaskDetail, findTaskList } from '@/modules/tasks';
import { getPersonalScope, getViewer } from '../../../viewer';
import { PageFrame } from '../../page-frame';
import { buildTaskContext } from '../../tasks/task-context.server';
import { TaskDetailPanel } from '../../tasks/task-detail';
import { SaveViewButton } from '../filter-bar';
import { TaskViewSection } from '../task-view';
import { readViewParams, type PageSearchParams } from '../view-params';

/**
 * Yeni görünüm (kenar çubuğu "Kayıtlı görünümler +"): tüm projelerdeki görevler üzerinde filtre ve sıralama kurulur,
 * "Görünümü kaydet" ile kayıtlı görünüm olur (FR-VIEW-07). Varsayılan kapsam Görevlerim ile aynıdır.
 */
export default async function NewViewPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const [viewer, scope, t, query] = await Promise.all([
    getViewer(),
    getPersonalScope(),
    getTranslations('views'),
    searchParams,
  ]);
  if (!viewer || !scope) return null;
  const { filter, settings, viewType, task } = readViewParams(query);
  const [list, context, projects, tags, detail] = await Promise.all([
    findTaskList(scope, viewer.preferences, filter, settings, viewType),
    buildTaskContext(viewer, scope),
    findActiveProjects(scope),
    findManagedTags(scope),
    task ? findTaskDetail(scope, task) : null,
  ]);
  return (
    <PageFrame title={t('newTitle')}>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-text">{t('newTitle')}</h1>
        <p className="text-sm text-text-secondary">{t('newDescription')}</p>
      </div>
      <TaskViewSection
        tasks={list.tasks}
        ignored={list.ignored}
        filter={filter}
        settings={settings}
        viewType={viewType}
        task={task}
        context={context}
        options={{ projects, tags }}
        saveSlot={
          <SaveViewButton
            workspaceId={scope.workspaceId}
            filter={filter}
            settings={settings}
            viewType={viewType}
          />
        }
      />
      {task ? <TaskDetailPanel detail={detail} context={context} /> : null}
    </PageFrame>
  );
}
