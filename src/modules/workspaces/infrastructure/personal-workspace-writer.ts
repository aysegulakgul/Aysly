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
