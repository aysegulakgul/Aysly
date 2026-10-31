import {
  getTableColumns,
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  sql,
} from 'drizzle-orm';
import type { WorkspaceScope } from '@/modules/workspaces';
import type { DbExecutor } from '@/shared/db/client';
import { isUuid } from '@/shared/kernel/id';
import type { ProjectRepository } from '../application/projects';
import type { Project, ProjectColor, ProjectStatus } from '../domain/project';
import { projects } from './schema';

/** Satır kolonları; arama kolonu (`search_vector`, D-091) yalnızca arama sorgularında okunur. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kolon bilerek dışarıda bırakılır
const { searchVector: _searchVector, ...projectRow } = getTableColumns(projects);

type Row = Omit<typeof projects.$inferSelect, 'searchVector'>;

// Değerler veritabanı CHECK kısıtlarıyla sınırlıdır (schema.ts).
export function toProject(row: Row): Project {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    kind: row.kind === 'inbox' ? 'inbox' : 'standard',
    name: row.name,
    description: row.description,
    color: row.color as ProjectColor,
    status: row.status as ProjectStatus,
    position: row.position,
    archivedAt: row.archivedAt,
    deletedAt: row.deletedAt,
    deletedBatchId: row.deletedBatchId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const inScope = (scope: WorkspaceScope) =>
  and(eq(projects.workspaceId, scope.workspaceId), isNull(projects.deletedAt));

export function createDrizzleProjectRepository(db: DbExecutor): ProjectRepository {
  return {
    async insert(scope, p) {
      const [row] = await db
        .insert(projects)
        .values({
          id: p.id,
          workspaceId: scope.workspaceId,
          kind: 'standard',
          name: p.name,
          description: p.description,
          color: p.color,
          status: 'active',
          position: p.position,
          createdBy: scope.userId,
          createdAt: p.now,
          updatedAt: p.now,
        })
        .returning();
      return toProject(row!);
    },

    async findById(scope, id) {
      if (!isUuid(id)) return null;
      const [row] = await db
        .select(projectRow)
        .from(projects)
        .where(and(inScope(scope), eq(projects.id, id)))
        .limit(1);
      return row ? toProject(row) : null;
    },

    async update(scope, id, expectedVersion, changes, now) {
      const [row] = await db
        .update(projects)
        .set({ ...changes, version: sql`${projects.version} + 1`, updatedAt: now })
        .where(and(inScope(scope), eq(projects.id, id), eq(projects.version, expectedVersion)))
        .returning();
      return row ? toProject(row) : null;
    },

    async list(scope, filter) {
      const rows = await db
        .select(projectRow)
        .from(projects)
        .where(
          and(
            inScope(scope),
            eq(projects.kind, 'standard'),
            filter.includeArchived ? undefined : isNull(projects.archivedAt),
            filter.statuses?.length ? inArray(projects.status, [...filter.statuses]) : undefined,
          ),
        )
        .orderBy(asc(projects.position), asc(projects.id));
      return rows.map(toProject);
    },

    async lastPosition(scope) {
      const [row] = await db
        .select({ position: projects.position })
        .from(projects)
        .where(eq(projects.workspaceId, scope.workspaceId))
        .orderBy(desc(projects.position))
        .limit(1);
      return row?.position ?? null;
    },
  };
}

/** Çöpteki proje dahil (BR-DEL-007: durum sorgusu ve geri yükleme için). */
export async function findAnyProject(
  db: DbExecutor,
  scope: WorkspaceScope,
  id: string,
): Promise<Project | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select(projectRow)
    .from(projects)
    .where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, id)))
    .limit(1);
  return row ? toProject(row) : null;
}

/** BR-PROJ-005 / BR-DEL-006: proje, görevleriyle aynı silme grubuyla çöpe gider. Inbox hiçbir zaman (DB CHECK). */
export async function trashProject(
  db: DbExecutor,
  scope: WorkspaceScope,
  id: string,
  batchId: string,
  now: Date,
): Promise<boolean> {
  const rows = await db
    .update(projects)
    .set({
      deletedAt: now,
      deletedBatchId: batchId,
      version: sql`${projects.version} + 1`,
      updatedAt: now,
    })
    .where(and(inScope(scope), eq(projects.id, id), eq(projects.kind, 'standard')))
    .returning({ id: projects.id });
  return rows.length > 0;
}

/** BR-DEL-004: geri yükleme; sürüm artar. */
export async function restoreProjects(
  db: DbExecutor,
  scope: WorkspaceScope,
  ids: readonly string[],
  now: Date,
): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db
    .update(projects)
    .set({
      deletedAt: null,
      deletedBatchId: null,
      version: sql`${projects.version} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(projects.workspaceId, scope.workspaceId),
        inArray(projects.id, [...ids]),
        isNotNull(projects.deletedAt),
      ),
    )
    .returning({ id: projects.id });
  return rows.length;
}

/** Çöpteki projeler; grup kimliği verilirse yalnızca o grup. */
export async function listTrashedProjects(
  db: DbExecutor,
  scope: WorkspaceScope,
  batchId?: string,
): Promise<Project[]> {
  if (batchId !== undefined && !isUuid(batchId)) return [];
  const rows = await db
    .select(projectRow)
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, scope.workspaceId),
        isNotNull(projects.deletedAt),
        batchId ? eq(projects.deletedBatchId, batchId) : undefined,
      ),
    )
    .orderBy(desc(projects.deletedAt));
  return rows.map(toProject);
}

/**
 * BR-DEL-005: yalnızca çöpteki projeler kalıcı silinir; görevleri bileşik yabancı anahtarla birlikte silinir.
 * Grup verilmezse tüm çöp.
 */
export async function purgeProjects(
  db: DbExecutor,
  scope: WorkspaceScope,
  batchId: string | null,
): Promise<number> {
  if (batchId !== null && !isUuid(batchId)) return 0;
  const rows = await db
    .delete(projects)
    .where(
      and(
        eq(projects.workspaceId, scope.workspaceId),
        isNotNull(projects.deletedAt),
        batchId ? eq(projects.deletedBatchId, batchId) : undefined,
      ),
    )
    .returning({ id: projects.id });
  return rows.length;
}

/** BR-DEL-003 / D-053: süresi dolan çöpteki projeler (tüm çalışma alanları; sistem işi). İdempotent. */
export async function purgeExpiredProjects(db: DbExecutor, before: Date): Promise<number> {
  const rows = await db
    .delete(projects)
    .where(and(isNotNull(projects.deletedAt), lt(projects.deletedAt, before)))
    .returning({ id: projects.id });
  return rows.length;
}

/** Süresi dolan çöpteki projeler ve alanlarının Inbox'ı (BR-DEL-004 için; sistem işi). */
export async function listExpiredTrashedProjects(
  db: DbExecutor,
  before: Date,
): Promise<{ projectId: string; inboxId: string }[]> {
  const expired = await db
    .select({ id: projects.id, workspaceId: projects.workspaceId })
    .from(projects)
    .where(and(isNotNull(projects.deletedAt), lt(projects.deletedAt, before)));
  if (expired.length === 0) return [];
  const inboxes = await db
    .select({ id: projects.id, workspaceId: projects.workspaceId })
    .from(projects)
    .where(
      and(
        eq(projects.kind, 'inbox'),
        inArray(projects.workspaceId, [...new Set(expired.map((p) => p.workspaceId))]),
      ),
    );
  const inboxOf = new Map(inboxes.map((i) => [i.workspaceId, i.id]));
  return expired.flatMap((p) => {
    const inboxId = inboxOf.get(p.workspaceId);
    return inboxId ? [{ projectId: p.id, inboxId }] : [];
  });
}
