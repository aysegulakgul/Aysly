import { getTranslations } from 'next-intl/server';
import { findProjectOverview } from '@/modules/tasks';
import { getPersonalScope, getViewer } from '../../viewer';
import { PageFrame } from '../page-frame';
import { ProjectsList, type ProjectSort, type ProjectStatusFilter } from './projects-list';

const STATUS_FILTERS = ['active', 'on_hold', 'completed', 'all'] as const;
const SORTS = ['updated', 'name', 'manual'] as const;

/**
 * Projeler (Figma 4:67037, mobil 4:68342; FR-PROJ-03/04): kartlarda ad, açıklama, durum, ilerleme, açık görev
 * sayısı ve son güncelleme. Filtre (durum, varsayılan Aktif) ve sıralama (son güncelleme, ad, manuel) URL'de.
 * Inbox proje sayısına dahil değildir (BR-PROJ-006).
 */
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string; deleted?: string }>;
}) {
  const [viewer, scope, t, query] = await Promise.all([
    getViewer(),
    getPersonalScope(),
    getTranslations('projects'),
    searchParams,
  ]);
  if (!viewer || !scope) return null;
  const status: ProjectStatusFilter = STATUS_FILTERS.find((s) => s === query.status) ?? 'active';
  const sort: ProjectSort = SORTS.find((s) => s === query.sort) ?? 'updated';
  const projects = await findProjectOverview(scope);
  return (
    <PageFrame title={t('title')}>
      <ProjectsList
        projects={projects}
        status={status}
        sort={sort}
        workspaceId={scope.workspaceId}
        timezone={viewer.preferences.timezone}
        timeFormat={viewer.preferences.timeFormat}
        deletedBatch={query.deleted}
      />
    </PageFrame>
  );
}
