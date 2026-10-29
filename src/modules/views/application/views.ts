import { generateKeyBetween } from 'fractional-indexing';
import { authorize, type WorkspaceScope } from '@/modules/workspaces';
import type { Clock } from '@/shared/kernel/clock';
import { businessRule, notFound, validationError, type DomainError } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import type { TaskFilter, ViewSettings, ViewType } from '../domain/task-filter';

export const VIEW_NAME_MAX = 60;
export const VIEWS_PER_USER = 50; // BR-VIEW-001

export type SavedView = {
  id: string;
  name: string;
  viewType: ViewType;
  filter: TaskFilter;
  sort: ViewSettings['sort'];
  groupBy: ViewSettings['groupBy'];
  position: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ViewChanges = {
  [K in 'name' | 'viewType' | 'filter' | 'sort' | 'groupBy']?: SavedView[K] | undefined;
};

/** Kayıtlı görünüm deposu: kayıtlar aktöre aittir (sahip + çalışma alanı kapsamı). */
export type ViewRepository = {
  list(scope: WorkspaceScope): Promise<SavedView[]>;
  find(scope: WorkspaceScope, id: string): Promise<SavedView | null>;
  count(scope: WorkspaceScope): Promise<number>;
  lastPosition(scope: WorkspaceScope): Promise<string | null>;
  insert(
    scope: WorkspaceScope,
    view: Omit<SavedView, 'version' | 'createdAt' | 'updatedAt'>,
    now: Date,
  ): Promise<SavedView>;
  update(
    scope: WorkspaceScope,
    id: string,
    expectedVersion: number,
    changes: ViewChanges,
    now: Date,
  ): Promise<SavedView | null>;
  remove(scope: WorkspaceScope, id: string): Promise<boolean>;
};

export type ViewDeps = { views: ViewRepository; clock: Clock; newId: () => string };

/** BR-VIEW-001: ad kırpılır; 1–60 karakter. */
function normalizeName(raw: string) {
  const name = raw.replace(/[\r\n]+/g, ' ').trim();
  if (name.length === 0) return err({ field: 'name', reason: 'required' });
  if (name.length > VIEW_NAME_MAX) return err({ field: 'name', reason: 'too_long' });
  return ok(name);
}

/** Kayıtlı görünümler kişiseldir (D-051); izin: kendi görünümleri (ROLES_AND_PERMISSIONS `view.manage_own`). */
const canRead = (scope: WorkspaceScope) => authorize(scope, 'view.manage_own');

export async function listViews(
  deps: ViewDeps,
  scope: WorkspaceScope,
): Promise<Result<SavedView[], DomainError>> {
  const allowed = canRead(scope);
  if (!allowed.ok) return allowed;
  return ok(await deps.views.list(scope));
}

export async function getView(
  deps: ViewDeps,
  scope: WorkspaceScope,
  id: string,
): Promise<Result<SavedView, DomainError>> {
  const allowed = canRead(scope);
  if (!allowed.ok) return allowed;
  const view = await deps.views.find(scope, id);
  return view ? ok(view) : err(notFound());
}

/** BR-VIEW-001: ad, görünüm türü, filtre ve sıralama saklanır; kullanıcı başına en fazla 50 görünüm. */
export async function createView(
  deps: ViewDeps,
  scope: WorkspaceScope,
  command: { name: string; viewType: ViewType; filter: TaskFilter } & ViewSettings,
): Promise<Result<SavedView, DomainError>> {
  const allowed = canRead(scope);
  if (!allowed.ok) return allowed;
  const name = normalizeName(command.name);
  if (!name.ok) return err(validationError([name.error]));
  if ((await deps.views.count(scope)) >= VIEWS_PER_USER) {
    return err(businessRule('BR-VIEW-001'));
  }
  const last = await deps.views.lastPosition(scope);
  return ok(
    await deps.views.insert(
      scope,
      {
        id: deps.newId(),
        name: name.value,
        viewType: command.viewType,
        filter: command.filter,
        sort: command.sort,
        groupBy: command.groupBy,
        position: generateKeyBetween(last, null),
      },
      deps.clock.now(),
    ),
  );
}

export async function updateView(
  deps: ViewDeps,
  scope: WorkspaceScope,
  id: string,
  command: { version: number } & ViewChanges,
): Promise<Result<SavedView, DomainError>> {
  const allowed = canRead(scope);
  if (!allowed.ok) return allowed;
  const current = await deps.views.find(scope, id);
  if (!current) return err(notFound());
  const { version, ...changes } = command;
  if (changes.name !== undefined) {
    const name = normalizeName(changes.name);
    if (!name.ok) return err(validationError([name.error]));
    changes.name = name.value;
  }
  const updated = await deps.views.update(scope, id, version, changes, deps.clock.now());
  if (updated) return ok(updated);
  const latest = await deps.views.find(scope, id);
  return latest ? err({ kind: 'version_conflict', current: latest }) : err(notFound());
}

/** Görünüm silme kalıcıdır; görevler etkilenmez (yalnızca filtre tanımı silinir). */
export async function deleteView(
  deps: ViewDeps,
  scope: WorkspaceScope,
  id: string,
): Promise<Result<null, DomainError>> {
  const allowed = canRead(scope);
  if (!allowed.ok) return allowed;
  return (await deps.views.remove(scope, id)) ? ok(null) : err(notFound());
}
