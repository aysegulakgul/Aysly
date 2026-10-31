import { getTranslations } from 'next-intl/server';
import { findProjectBoardTasks, findProjectOverview } from '@/modules/tasks';
import { getPersonalScope, getViewer } from '../../viewer';
import { PageFrame } from '../page-frame';
import { buildTaskContext } from '../tasks/task-context.server';
import { ProjectsBoard } from './projects-board';

/**
 * Projeler (D-100): projelerin durum sütunlarında renkli bir panoda, görevleri statüleri ve alt görev sayılarıyla
 * tek ekranda göründüğü özet. Inbox proje sayısına dahil değildir (BR-PROJ-006). `?deleted=` proje sayfasından
 * silme sonrası "Geri al"ı gösterir (BR-DEL-006).
 */
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const [viewer, scope, t, query] = await Promise.all([
    getViewer(),
    getPersonalScope(),
    getTranslations('projects'),
    searchParams,
  ]);
  if (!viewer || !scope) return null;
  const [projects, context] = await Promise.all([
    findProjectOverview(scope),
    buildTaskContext(viewer, scope),
  ]);
  const tasks = await findProjectBoardTasks(
    scope,
    projects.map((p) => p.id),
  );
  return (
    <PageFrame title={t('title')} wide>
      <ProjectsBoard
        projects={projects}
        tasks={tasks}
        workspaceId={scope.workspaceId}
        context={context}
        deletedBatch={query.deleted}
      />
    </PageFrame>
  );
}
