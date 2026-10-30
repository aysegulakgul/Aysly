import { getTranslations } from 'next-intl/server';
import { findGoal, findGoals } from '@/modules/goals';
import { findActiveProjects } from '@/modules/projects';
import { getPersonalScope, getViewer } from '../../viewer';
import { PageFrame } from '../page-frame';
import { GoalsWorkspace } from './goals-workspace';

const TABS = ['active', 'achieved', 'abandoned'] as const;

/**
 * Hedefler (Figma 4:67474 masaüstü, 4:68732 mobil; FR-GOAL-01..04): Aktif / Ulaşılan / Bırakılan sekmeleri, hedef
 * kartları ve seçili hedefin detayı (`?goal=`).
 */
export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; goal?: string }>;
}) {
  const [viewer, scope, t, query] = await Promise.all([
    getViewer(),
    getPersonalScope(),
    getTranslations('goals'),
    searchParams,
  ]);
  if (!viewer || !scope) return null;
  const status = TABS.find((s) => s === query.status) ?? 'active';
  const [goals, current, projects] = await Promise.all([
    findGoals(scope, { status }),
    query.goal ? findGoal(scope, query.goal) : null,
    findActiveProjects(scope),
  ]);
  return (
    <PageFrame title={t('title')} wide>
      <GoalsWorkspace
        goals={goals}
        current={current}
        status={status}
        workspaceId={scope.workspaceId}
        projects={projects.filter((p) => p.kind === 'standard')}
      />
    </PageFrame>
  );
}
