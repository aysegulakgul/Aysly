import { and, eq, isNull } from 'drizzle-orm';
import type { DbExecutor } from '@/shared/db/client';
import { isUuid } from '@/shared/kernel/id';
import type { Role } from '../domain/permissions';
import { createScope, type WorkspaceScope } from '../domain/scope';
import { workspaceMemberships, workspaces } from './schema';

/**
 * Aktörün çalışma alanındaki etkin üyeliğini çözer. Üyelik yoksa, alan silinmişse veya kimlik geçersizse null
 * döner; çağıran bunu 404 olarak yanıtlar (BR-PERM-001: varlık ifşa edilmez).
 */
export async function resolveWorkspaceScope(
  db: DbExecutor,
  userId: string,
  workspaceId: string,
): Promise<WorkspaceScope | null> {
  if (!isUuid(workspaceId)) return null;
  const [row] = await db
    .select({ role: workspaceMemberships.role })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, userId),
        eq(workspaceMemberships.status, 'active'),
        isNull(workspaces.deletedAt),
      ),
    )
    .limit(1);
  return row?.role === 'owner' ? createScope(userId, workspaceId, row.role as Role) : null;
}

/** Aktörün etkin üyelikleri (API_CONTRACTS §4: GET /workspaces; MVP'de yalnızca kişisel alan). */
export function listMemberships(db: DbExecutor, userId: string) {
  return db
    .select({
      id: workspaces.id,
      type: workspaces.type,
      name: workspaces.name,
      role: workspaceMemberships.role,
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
    .where(
      and(
        eq(workspaceMemberships.userId, userId),
        eq(workspaceMemberships.status, 'active'),
        isNull(workspaces.deletedAt),
      ),
    );
}
