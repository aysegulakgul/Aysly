import { and, eq } from 'drizzle-orm';
import type { DbExecutor } from '@/shared/db/client';
import { workspaceMemberships, workspaces } from './schema';

/** BR-WS-001: kişisel çalışma alanı ve sahip üyeliği. Çağıranın işlemi içinde çalışır. */
export async function insertPersonalWorkspace(
  db: DbExecutor,
  input: {
    workspaceId: string;
    membershipId: string;
    ownerUserId: string;
    name: string;
    now: Date;
  },
): Promise<void> {
  await db.insert(workspaces).values({
    id: input.workspaceId,
    type: 'personal',
    name: input.name,
    ownerUserId: input.ownerUserId,
    createdAt: input.now,
    updatedAt: input.now,
  });
  await db.insert(workspaceMemberships).values({
    id: input.membershipId,
    workspaceId: input.workspaceId,
    userId: input.ownerUserId,
    role: 'owner',
    status: 'active',
    createdAt: input.now,
    updatedAt: input.now,
  });
}

/** Kullanıcının kişisel çalışma alanı (BR-WS-001: tam olarak bir tane). */
export async function findPersonalWorkspaceId(
  db: DbExecutor,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.ownerUserId, userId), eq(workspaces.type, 'personal')))
    .limit(1);
  return row?.id ?? null;
}
