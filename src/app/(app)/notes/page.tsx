import { getTranslations } from 'next-intl/server';
import { findNote, findNotes } from '@/modules/notes';
import { findActiveProjects } from '@/modules/projects';
import { getPersonalScope, getViewer } from '../../viewer';
import { PageFrame } from '../page-frame';
import { NotesWorkspace } from './notes-workspace';

/**
 * Notlar (Figma 4:67588 masaüstü; 4:68829 mobil liste, 4:68882 mobil editör; FR-NOTE-01..05): solda arama,
 * sabitlenenler ve not kartları; sağda editör. `?note=<id>` açık not, `?note=new` yeni not.
 */
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string; q?: string }>;
}) {
  const [viewer, scope, t, query] = await Promise.all([
    getViewer(),
    getPersonalScope(),
    getTranslations('notes'),
    searchParams,
  ]);
  if (!viewer || !scope) return null;
  const fallback = t('untitled');
  const [notes, current, projects] = await Promise.all([
    findNotes(scope, query.q ? { q: query.q } : {}, fallback),
    query.note && query.note !== 'new' ? findNote(scope, query.note, fallback) : null,
    findActiveProjects(scope),
  ]);
  return (
    <PageFrame title={t('title')} wide>
      <NotesWorkspace
        notes={notes}
        current={current}
        isNew={query.note === 'new'}
        q={query.q ?? ''}
        workspaceId={scope.workspaceId}
        timezone={viewer.preferences.timezone}
        timeFormat={viewer.preferences.timeFormat}
        projects={projects}
      />
    </PageFrame>
  );
}
