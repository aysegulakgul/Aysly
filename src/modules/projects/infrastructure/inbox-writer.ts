import type { DbExecutor } from '@/shared/db/client';
import { projects } from './schema';

/** D-030 / BR-PROJ-006: her çalışma alanında silinemeyen tek Inbox. Çağıranın işlemi içinde çalışır. */
export async function insertInbox(
  db: DbExecutor,
  input: { projectId: string; workspaceId: string; createdBy: string; now: Date },
): Promise<void> {
  await db.insert(projects).values({
    id: input.projectId,
    workspaceId: input.workspaceId,
    kind: 'inbox',
    name: 'Inbox',
    color: 'slate',
    status: 'active',
    position: 'a0',
    createdBy: input.createdBy,
    createdAt: input.now,
    updatedAt: input.now,
  });
}
