import { generateKeyBetween } from 'fractional-indexing';
import { authorize, type WorkspaceScope } from '@/modules/workspaces';
import type { Clock } from '@/shared/kernel/clock';
import {
  businessRule,
  notFound,
  validationError,
  type DomainError,
  type FieldIssue,
} from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import {
  normalizeProjectDescription,
  normalizeProjectName,
  type Project,
  type ProjectColor,
  type ProjectStatus,
} from '../domain/project';

export type ProjectChanges = Partial<{
  name: string;
  description: string | null;
  color: ProjectColor;
  status: ProjectStatus;
  position: string;
  archivedAt: Date | null;
}>;

export type ProjectListFilter = {
  statuses?: readonly ProjectStatus[] | undefined;
  includeArchived?: boolean | undefined;
};

/** Proje deposu; her metot `WorkspaceScope` ister (ARCHITECTURE §6). Çöpteki projeler dönmez (BR-DEL-007). */
export type ProjectRepository = {
  insert(
    scope: WorkspaceScope,
    project: {
      id: string;
      name: string;
      description: string | null;
      color: ProjectColor;
      position: string;
      now: Date;
    },
  ): Promise<Project>;
  findById(scope: WorkspaceScope, id: string): Promise<Project | null>;
  /** Sürüm eşleşmezse null (BR-TASK-010 ile aynı yöntem). */
  update(
    scope: WorkspaceScope,
    id: string,
    expectedVersion: number,
    changes: ProjectChanges,
    now: Date,
  ): Promise<Project | null>;
  /** Standart projeler (Inbox hariç, BR-PROJ-006), konum sırasıyla. */
  list(scope: WorkspaceScope, filter: ProjectListFilter): Promise<Project[]>;
  lastPosition(scope: WorkspaceScope): Promise<string | null>;
};

export type ProjectDeps = { projects: ProjectRepository; clock: Clock; newId: () => string };

const conflict = (current: Project): DomainError => ({ kind: 'version_conflict', current });

async function save(
  deps: ProjectDeps,
  scope: WorkspaceScope,
  current: Project,
  version: number,
  changes: ProjectChanges,
): Promise<Result<Project, DomainError>> {
  const updated = await deps.projects.update(scope, current.id, version, changes, deps.clock.now());
  if (updated) return ok(updated);
  const latest = await deps.projects.findById(scope, current.id);
  return latest ? err(conflict(latest)) : err(notFound());
}

/** FR-PROJ-01, BR-PROJ-001: yeni proje listenin sonuna eklenir (kesirli sıralama, BR-TASK-006 ile aynı yöntem). */
export async function createProject(
  deps: ProjectDeps,
  scope: WorkspaceScope,
  command: {
    name: string;
    description?: string | null | undefined;
    color?: ProjectColor | undefined;
  },
): Promise<Result<Project, DomainError>> {
  const allowed = authorize(scope, 'project.create');
  if (!allowed.ok) return allowed;
  const issues: FieldIssue[] = [];
  const name = normalizeProjectName(command.name);
  if (!name.ok) issues.push(name.error);
  const description = normalizeProjectDescription(command.description ?? null);
  if (!description.ok) issues.push(description.error);
  if (!name.ok || !description.ok) return err(validationError(issues));
  const last = await deps.projects.lastPosition(scope);
  return ok(
    await deps.projects.insert(scope, {
      id: deps.newId(),
      name: name.value,
      description: description.value,
      color: command.color ?? 'slate',
      position: generateKeyBetween(last, null),
      now: deps.clock.now(),
    }),
  );
}

export type UpdateProjectCommand = {
  version: number;
  name?: string | undefined;
  description?: string | null | undefined;
  color?: ProjectColor | undefined;
  status?: ProjectStatus | undefined;
};

/**
 * Proje düzenleme (FR-PROJ-01/02). BR-PROJ-006: Inbox yeniden adlandırılamaz, durumu değişmez. BR-DEL-002 /
 * BR-PROJ-004: arşivli proje salt okunurdur. BR-PROJ-002: durumu "Tamamlandı" yapmak görevleri değiştirmez
 * (açık görevleri de tamamlamak için tamamlama işlemi kullanılır).
 */
export async function updateProject(
  deps: ProjectDeps,
  scope: WorkspaceScope,
  id: string,
  command: UpdateProjectCommand,
): Promise<Result<Project, DomainError>> {
  const allowed = authorize(scope, 'project.update');
  if (!allowed.ok) return allowed;
  const current = await deps.projects.findById(scope, id);
  if (!current) return err(notFound());
  if (current.kind === 'inbox') return err(businessRule('BR-PROJ-006'));
  if (current.archivedAt) return err(businessRule('BR-PROJ-004'));

  const issues: FieldIssue[] = [];
  const changes: ProjectChanges = {};
  if (command.name !== undefined) {
    const name = normalizeProjectName(command.name);
    if (name.ok) changes.name = name.value;
    else issues.push(name.error);
  }
  if (command.description !== undefined) {
    const description = normalizeProjectDescription(command.description);
    if (description.ok) changes.description = description.value;
    else issues.push(description.error);
  }
  if (command.color !== undefined) changes.color = command.color;
  if (command.status !== undefined) changes.status = command.status;
  if (issues.length > 0) return err(validationError(issues));
  return save(deps, scope, current, command.version, changes);
}

/**
 * BR-PROJ-004: arşivlenen projenin kendisi ve görevleri salt okunur olur; görevlerin `archived_at` alanı
 * değişmez (salt okunurluk projeden gelir). BR-PROJ-006: Inbox arşivlenemez.
 */
export async function archiveProject(
  deps: ProjectDeps,
  scope: WorkspaceScope,
  id: string,
  command: { version: number },
): Promise<Result<Project, DomainError>> {
  const allowed = authorize(scope, 'project.archive');
  if (!allowed.ok) return allowed;
  const current = await deps.projects.findById(scope, id);
  if (!current) return err(notFound());
  if (current.kind === 'inbox') return err(businessRule('BR-PROJ-006'));
  if (current.archivedAt) return ok(current);
  return save(deps, scope, current, command.version, { archivedAt: deps.clock.now() });
}

/** BR-PROJ-004 (6–7): görevler yeniden düzenlenebilir olur; ayrıca arşivlenmiş görevler arşivli kalır. */
export async function unarchiveProject(
  deps: ProjectDeps,
  scope: WorkspaceScope,
  id: string,
  command: { version: number },
): Promise<Result<Project, DomainError>> {
  const allowed = authorize(scope, 'project.archive');
  if (!allowed.ok) return allowed;
  const current = await deps.projects.findById(scope, id);
  if (!current) return err(notFound());
  if (!current.archivedAt) return ok(current);
  return save(deps, scope, current, command.version, { archivedAt: null });
}

/**
 * FR-PROJ-04 manuel sıralama: proje verilen komşuların arasına taşınır; yalnızca taşınan projenin konumu
 * değişir (BR-TASK-006 ile aynı yöntem). Sürüm kontrolü yapılmaz: sıra kişisel bir görünüm tercihidir.
 */
export async function reorderProject(
  deps: ProjectDeps,
  scope: WorkspaceScope,
  command: { id: string; beforeId?: string | undefined; afterId?: string | undefined },
): Promise<Result<Project, DomainError>> {
  const allowed = authorize(scope, 'project.update');
  if (!allowed.ok) return allowed;
  const current = await deps.projects.findById(scope, command.id);
  if (!current) return err(notFound());
  if (current.kind === 'inbox') return err(businessRule('BR-PROJ-006'));
  const neighbour = async (id: string | undefined) => {
    if (!id) return null;
    const project = await deps.projects.findById(scope, id);
    return project && project.kind === 'standard' && project.id !== current.id
      ? project
      : undefined;
  };
  const before = await neighbour(command.beforeId);
  const after = await neighbour(command.afterId);
  if (before === undefined || after === undefined) return err(notFound());
  // `afterId`: bu projenin ardına; `beforeId`: bu projenin önüne.
  const lower = after?.position ?? null;
  const upper = before?.position ?? null;
  if (lower !== null && upper !== null && lower >= upper) {
    return err(validationError([{ field: 'beforeId', reason: 'invalid' }]));
  }
  if (lower === null && upper === null) return ok(current);
  const position = generateKeyBetween(lower, upper);
  return save(deps, scope, current, current.version, { position });
}

export async function getProject(
  deps: ProjectDeps,
  scope: WorkspaceScope,
  id: string,
): Promise<Result<Project, DomainError>> {
  const allowed = authorize(scope, 'project.read');
  if (!allowed.ok) return allowed;
  const project = await deps.projects.findById(scope, id);
  return project ? ok(project) : err(notFound());
}

export async function listProjects(
  deps: ProjectDeps,
  scope: WorkspaceScope,
  filter: ProjectListFilter,
): Promise<Result<Project[], DomainError>> {
  const allowed = authorize(scope, 'project.read');
  if (!allowed.ok) return allowed;
  return ok(await deps.projects.list(scope, filter));
}
