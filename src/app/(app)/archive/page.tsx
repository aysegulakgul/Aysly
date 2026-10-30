import { getTranslations } from 'next-intl/server';
import { findArchiveContents } from '@/modules/lifecycle';
import { getPersonalScope, getViewer } from '../../viewer';
import { PageFrame } from '../page-frame';
import { ArchiveList } from './archive-list';

const TYPES = ['projects', 'tasks', 'notes', 'goals'] as const;

/**
 * Arşiv (FR-SET-06, USER_FLOWS §2.13; Figma'da yok, D-065): tür sekmeleri, her satırda "Arşivden çıkar".
 * Arşivli projenin görevleri proje altında kalır (BR-PROJ-004.2); tek başına arşivlenen görevler ayrı sekmede.
 */
export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const [viewer, scope, t, query] = await Promise.all([
    getViewer(),
    getPersonalScope(),
    getTranslations('archive'),
    searchParams,
  ]);
  if (!viewer || !scope) return null;
  const archive = await findArchiveContents(scope);
  return (
    <PageFrame title={t('title')}>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
        <p className="text-sm text-text-secondary">{t('description')}</p>
      </div>
      <ArchiveList
        archive={archive}
        type={TYPES.find((x) => x === query.type) ?? 'projects'}
        workspaceId={scope.workspaceId}
        timezone={viewer.preferences.timezone}
      />
    </PageFrame>
  );
}
