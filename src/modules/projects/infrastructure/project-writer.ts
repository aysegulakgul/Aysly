import { count, eq } from 'drizzle-orm';
import type { DbExecutor } from '@/shared/db/client';
import { projects } from './schema';

/**
 * Standart proje kaydı (ör. onboarding örnek projeleri, ONBOARDING §3). Proje yönetimi Faz 5'te gelir; o zamana
 * kadar yalnızca bu yazıcı vardır. Çağıranın işlemi içinde çalışır.
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
  const [existing] = await db
    .select({ n: count() })
    .from(projects)
    .where(eq(projects.workspaceId, input.workspaceId));
  // Konumlar sözlük sırasıyla karşılaştırılır: Inbox "a0", sonrakiler sabit uzunlukta "a0001", "a0002"…
  // Faz 5'te sürükle-bırak için kesirli sıralama bu değerlerin arasına yerleşir.
  const start = existing?.n ?? 0;
  await db.insert(projects).values(
    input.projects.map((p, i) => ({
      id: p.id,
      workspaceId: input.workspaceId,
      kind: 'standard',
      name: p.name,
      description: p.description ?? null,
      color: 'slate',
      status: 'active',
      position: `a${String(start + i).padStart(4, '0')}`,
      createdBy: input.createdBy,
      createdAt: input.now,
      updatedAt: input.now,
    })),
  );
}
