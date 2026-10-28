import { and, eq, isNull } from 'drizzle-orm';
import type { WorkspaceScope } from '@/modules/workspaces';
import type { DbExecutor } from '@/shared/db/client';
import { isUuid } from '@/shared/kernel/id';
import { projects } from './schema';

export type ProjectRef = { id: string; kind: 'inbox' | 'standard'; archived: boolean };

const columns = { id: projects.id, kind: projects.kind, archivedAt: projects.archivedAt };
const toRef = (row: { id: string; kind: string; archivedAt: Date | null }): ProjectRef => ({
  id: row.id,
  kind: row.kind === 'inbox' ? 'inbox' : 'standard',
  archived: row.archivedAt !== null,
});

/** Kapsamdaki proje; çöpteki proje veya başka çalışma alanınınki bulunamadı sayılır (BR-PERM-001, BR-DEL-007). */
export async function findProjectRef(
  db: DbExecutor,
  scope: WorkspaceScope,
  projectId: string,
): Promise<ProjectRef | null> {
  if (!isUuid(projectId)) return null;
  const [row] = await db
    .select(columns)
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, scope.workspaceId),
        eq(projects.id, projectId),
        isNull(projects.deletedAt),
      ),
    )
    .limit(1);
  return row ? toRef(row) : null;
}

/** D-030: her çalışma alanında tam olarak bir Inbox vardır. */
export async function findInboxRef(db: DbExecutor, scope: WorkspaceScope): Promise<ProjectRef> {
  const [row] = await db
    .select(columns)
    .from(projects)
    .where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.kind, 'inbox')))
    .limit(1);
  if (!row) throw new Error('çalışma alanında Inbox yok'); // BR-PROJ-006 ihlali: beklenmeyen durum
  return toRef(row);
}
