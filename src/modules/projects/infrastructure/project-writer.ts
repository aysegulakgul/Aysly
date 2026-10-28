import { desc, eq } from 'drizzle-orm';
import { generateNKeysBetween } from 'fractional-indexing';
import type { DbExecutor } from '@/shared/db/client';
import { projects } from './schema';

/**
 * Standart proje kaydı (ör. onboarding örnek projeleri, ONBOARDING §3). Proje yönetimi Faz 5'te gelir; o zamana
 * kadar yalnızca bu yazıcı vardır. Yeni projeler son projenin ardına kesirli sıralama anahtarıyla eklenir
 * (BR-TASK-006 ile aynı yöntem). Çağıranın işlemi içinde çalışır.
 */
export async function insertProjects(
  db: DbExecutor,
  input: {
    workspaceId: string;
    createdBy: string;
    projects: { id: string; name: string; description?: string | undefined }[];
    now: Date;
  },
): Promise<void> {
  if (input.projects.length === 0) return;
  const [last] = await db
    .select({ position: projects.position })
    .from(projects)
    .where(eq(projects.workspaceId, input.workspaceId))
    .orderBy(desc(projects.position))
    .limit(1);
  const positions = generateNKeysBetween(last?.position ?? null, null, input.projects.length);
  await db.insert(projects).values(
    input.projects.map((p, i) => ({
      id: p.id,
      workspaceId: input.workspaceId,
      kind: 'standard',
      name: p.name,
      description: p.description ?? null,
      color: 'slate',
      status: 'active',
      position: positions[i]!,
      createdBy: input.createdBy,
      createdAt: input.now,
      updatedAt: input.now,
    })),
  );
}
