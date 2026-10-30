import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { findProjectDetail, findTaskDetail, findTaskList } from '@/modules/tasks';
import { findManagedTags } from '@/modules/tags';
import { EMPTY_FILTER } from '@/modules/views';
import { getPersonalScope, getViewer } from '../../../viewer';
import { PageFrame } from '../../page-frame';
import { QuickCapture } from '../../tasks/quick-capture';
import { buildTaskContext } from '../../tasks/task-context.server';
import { TaskDetailPanel } from '../../tasks/task-detail';
import { SaveViewButton } from '../../views/filter-bar';
import { LinkedRecords } from '../../notes/linked-records';
import { TaskViewSection } from '../../views/task-view';
import { readViewParams, type PageSearchParams } from '../../views/view-params';
import { ProjectHeader, TrashedProject } from './project-header';

/**
 * Proje sayfası (Figma Liste 4:67132, Pano 4:67253; mobil 4:68426, 4:68533): başlık, durum, ilerleme
 * (BR-PROJ-003), Liste/Pano sekmeleri, filtre çubuğu ve görevler. Arşivli proje salt okunur (BR-PROJ-004); çöpteki
 * projeye gidilirse "çöp kutusunda" ekranı (BR-DEL-007). Bağlı notlar ve hedefler sayfa sonunda (Figma "Bağlı kayıtlar").
 */
export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const [viewer, scope, t, { id }, query] = await Promise.all([
    getViewer(),
    getPersonalScope(),
    getTranslations('projects'),
    params,
    searchParams,
  ]);
  if (!viewer || !scope) return null;
  const project = await findProjectDetail(scope, id);
  if (!project || project.kind === 'inbox') notFound();
  if (project.deletedAt) {
    return (
      <PageFrame title={project.name}>
        <TrashedProject
          project={project}
          workspaceId={scope.workspaceId}
          // BR-DEL-003: 30 günlük süreden kalan gün.
          daysLeft={Math.max(
            0,
            30 - Math.floor((new Date().getTime() - Date.parse(project.deletedAt)) / 86_400_000),
          )}
        />
      </PageFrame>
    );
  }

  const { filter, settings, viewType, task } = readViewParams(query, {
    filter: EMPTY_FILTER,
    settings: { sort: 'manual', groupBy: 'none' },
    viewType: 'list',
  });
  const scoped = { ...filter, projectId: [project.id] };
  const [list, context, tags, detail] = await Promise.all([
    findTaskList(scope, viewer.preferences, scoped, settings, viewType, {
      includeDone: viewType === 'list',
    }),
    buildTaskContext(viewer, scope),
    findManagedTags(scope),
    task ? findTaskDetail(scope, task) : null,
  ]);
  const archived = project.archivedAt !== null;
  return (
    <PageFrame title={`${t('title')} / ${project.name}`}>
      <ProjectHeader
        project={project}
        workspaceId={scope.workspaceId}
        timezone={viewer.preferences.timezone}
        timeFormat={viewer.preferences.timeFormat}
        existingNames={context.projects.filter((p) => p.kind === 'standard').map((p) => p.name)}
      />
      {archived ? null : (
        <div id="project-add">
          <QuickCapture context={context} projectId={project.id} />
        </div>
      )}
      <TaskViewSection
        tasks={list.tasks}
        ignored={list.ignored}
        filter={filter}
        settings={settings}
        viewType={viewType}
        task={task}
        context={context}
        options={{ projects: [], tags, lockedProject: true }}
        projectId={archived ? undefined : project.id}
        readOnly={archived}
        saveSlot={
          <SaveViewButton
            workspaceId={scope.workspaceId}
            filter={scoped}
            settings={settings}
            viewType={viewType}
            defaultName={project.name}
          />
        }
      />
      <LinkedRecords workspaceId={scope.workspaceId} target={{ kind: 'project', id: project.id }} />
      {task ? <TaskDetailPanel detail={detail} context={context} /> : null}
    </PageFrame>
  );
}
