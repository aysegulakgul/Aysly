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
  LINKS_PER_GOAL,
  checkGoalDescription,
  goalProgress,
  normalizeGoalTitle,
  type Goal,
  type GoalProgress,
  type GoalStatus,
  type ProgressMode,
} from '../domain/goal';

export type GoalChanges = Partial<{
  title: string;
  description: string | null;
  targetDate: string | null;
  status: GoalStatus;
  progressMode: ProgressMode;
  manualProgress: number | null;
  achievedAt: Date | null;
  archivedAt: Date | null;
}>;

export type GoalLinks = { taskIds: string[]; projectIds: string[] };

export type GoalListFilter = {
  status?: GoalStatus | undefined;
  includeArchived?: boolean | undefined;
  linkedTaskId?: string | undefined;
  linkedProjectId?: string | undefined;
};

export type GoalRepository = {
  insert(
    scope: WorkspaceScope,
    g: {
      id: string;
      title: string;
      description: string | null;
      targetDate: string | null;
      now: Date;
    },
  ): Promise<Goal>;
  findById(scope: WorkspaceScope, id: string): Promise<Goal | null>;
  findAny(scope: WorkspaceScope, id: string): Promise<Goal | null>;
  update(
    scope: WorkspaceScope,
    id: string,
    expectedVersion: number | null,
    changes: GoalChanges,
    now: Date,
  ): Promise<Goal | null>;
  list(scope: WorkspaceScope, filter: GoalListFilter): Promise<Goal[]>;
  trash(scope: WorkspaceScope, id: string, batchId: string, now: Date): Promise<boolean>;
  restore(scope: WorkspaceScope, id: string, now: Date): Promise<boolean>;
  listTrashed(scope: WorkspaceScope): Promise<Goal[]>;
  purge(scope: WorkspaceScope, id: string | null): Promise<number>;
  links(scope: WorkspaceScope, goalIds: readonly string[]): Promise<Map<string, GoalLinks>>;
  setLinks(scope: WorkspaceScope, goalId: string, links: GoalLinks): Promise<void>;
};

export type GoalDeps = {
  goals: GoalRepository;
  /** tasks modülünden: BR-GOAL-002 hesap ve BR-WS-002 bağlantı doğrulaması (çöpteki kayıt sayılmaz). */
  tasks: {
    progress(
      scope: WorkspaceScope,
      links: { taskIds: readonly string[]; projectIds: readonly string[] },
    ): Promise<{ done: number; total: number }>;
    validTasks(scope: WorkspaceScope, ids: readonly string[]): Promise<Set<string>>;
    validProjects(scope: WorkspaceScope, ids: readonly string[]): Promise<Set<string>>;
  };
  clock: Clock;
  newId: () => string;
};

export type GoalWithProgress = { goal: Goal; progress: GoalProgress; links: GoalLinks };

const readOnly = (goal: Goal) => (goal.archivedAt ? businessRule('BR-DEL-002') : null);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

async function withProgress(
  deps: GoalDeps,
  scope: WorkspaceScope,
  goals: Goal[],
): Promise<GoalWithProgress[]> {
  const links = await deps.goals.links(
    scope,
    goals.map((g) => g.id),
  );
  return Promise.all(
    goals.map(async (goal) => {
      const l = links.get(goal.id) ?? { taskIds: [], projectIds: [] };
      return { goal, links: l, progress: goalProgress(goal, await deps.tasks.progress(scope, l)) };
    }),
  );
}

/** FR-GOAL-01, BR-GOAL-001: başlık zorunlu; açıklama ≤ 5.000; hedef tarihi isteğe bağlı. */
export async function createGoal(
  deps: GoalDeps,
  scope: WorkspaceScope,
  command: {
    title: string;
    description?: string | null | undefined;
    targetDate?: string | null | undefined;
  },
): Promise<Result<Goal, DomainError>> {
  const allowed = authorize(scope, 'goal.create');
  if (!allowed.ok) return allowed;
  const issues: FieldIssue[] = [];
  const title = normalizeGoalTitle(command.title);
  if (!title.ok) issues.push(title.error);
  const description = command.description?.trim() ? command.description : null;
  issues.push(...checkGoalDescription(description));
  const targetDate = command.targetDate ?? null;
  if (targetDate !== null && !isDate(targetDate))
    issues.push({ field: 'targetDate', reason: 'invalid' });
  if (issues.length || !title.ok) return err(validationError(issues));
  return ok(
    await deps.goals.insert(scope, {
      id: deps.newId(),
      title: title.value,
      description,
      targetDate,
      now: deps.clock.now(),
    }),
  );
}

export type UpdateGoalCommand = {
  version: number;
  title?: string | undefined;
  description?: string | null | undefined;
  targetDate?: string | null | undefined;
  status?: GoalStatus | undefined;
  progressMode?: ProgressMode | undefined;
  manualProgress?: number | null | undefined;
};

/**
 * Düzenleme (FR-GOAL-01/03/04). BR-GOAL-002: mod değişince manuel değer saklanır; manuel değer 0–100 tamsayı.
 * BR-GOAL-003: "Ulaşıldı" bağlı kayıtları değiştirmez. Arşivli hedef salt okunur (BR-DEL-002).
 */
export async function updateGoal(
  deps: GoalDeps,
  scope: WorkspaceScope,
  id: string,
  command: UpdateGoalCommand,
): Promise<Result<Goal, DomainError>> {
  const allowed = authorize(scope, 'goal.update');
  if (!allowed.ok) return allowed;
  const current = await deps.goals.findById(scope, id);
  if (!current) return err(notFound());
  const blocked = readOnly(current);
  if (blocked) return err(blocked);
  const issues: FieldIssue[] = [];
  const changes: GoalChanges = {};
  if (command.title !== undefined) {
    const title = normalizeGoalTitle(command.title);
    if (title.ok) changes.title = title.value;
    else issues.push(title.error);
  }
  if (command.description !== undefined) {
    changes.description = command.description?.trim() ? command.description : null;
    issues.push(...checkGoalDescription(changes.description));
  }
  if (command.targetDate !== undefined) {
    if (command.targetDate !== null && !isDate(command.targetDate)) {
      issues.push({ field: 'targetDate', reason: 'invalid' });
    } else changes.targetDate = command.targetDate;
  }
  if (command.status !== undefined && command.status !== current.status) {
    changes.status = command.status;
    changes.achievedAt = command.status === 'achieved' ? deps.clock.now() : null;
  }
  if (command.progressMode !== undefined) changes.progressMode = command.progressMode;
  if (command.manualProgress !== undefined) {
    const value = command.manualProgress;
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 100)) {
      issues.push({ field: 'manualProgress', reason: 'invalid' });
    } else changes.manualProgress = value;
  }
  if (issues.length) return err(validationError(issues));
  const saved = await deps.goals.update(scope, id, command.version, changes, deps.clock.now());
  if (saved) return ok(saved);
  const latest = await deps.goals.findById(scope, id);
  return latest ? err({ kind: 'version_conflict', current: latest }) : err(notFound());
}

/** FR-GOAL-02, BR-GOAL-004: bağlı görev ve projeler (tam küme); aynı alan, çöpte değil. */
export async function setGoalLinks(
  deps: GoalDeps,
  scope: WorkspaceScope,
  id: string,
  links: GoalLinks,
): Promise<Result<null, DomainError>> {
  const allowed = authorize(scope, 'goal.update');
  if (!allowed.ok) return allowed;
  const goal = await deps.goals.findById(scope, id);
  if (!goal) return err(notFound());
  const blocked = readOnly(goal);
  if (blocked) return err(blocked);
  const taskIds = [...new Set(links.taskIds)];
  const projectIds = [...new Set(links.projectIds)];
  if (taskIds.length + projectIds.length > LINKS_PER_GOAL) {
    return err(validationError([{ field: 'links', reason: 'too_many' }]));
  }
  const [tasks, projects] = await Promise.all([
    deps.tasks.validTasks(scope, taskIds),
    deps.tasks.validProjects(scope, projectIds),
  ]);
  if (tasks.size < taskIds.length || projects.size < projectIds.length) return err(notFound());
  await deps.goals.setLinks(scope, id, { taskIds, projectIds });
  return ok(null);
}

export async function setGoalArchived(
  deps: GoalDeps,
  scope: WorkspaceScope,
  id: string,
  archived: boolean,
): Promise<Result<Goal, DomainError>> {
  const allowed = authorize(scope, 'goal.archive');
  if (!allowed.ok) return allowed;
  const goal = await deps.goals.findById(scope, id);
  if (!goal) return err(notFound());
  const now = deps.clock.now();
  return ok(
    (await deps.goals.update(scope, id, null, { archivedAt: archived ? now : null }, now))!,
  );
}

/** BR-DEL-001/006: hedef çöpe tek grup olarak gider; bağlantıları gizlenir (BR-GOAL-004). */
export async function deleteGoal(
  deps: GoalDeps,
  scope: WorkspaceScope,
  id: string,
): Promise<Result<{ batchId: string }, DomainError>> {
  const allowed = authorize(scope, 'goal.delete');
  if (!allowed.ok) return allowed;
  const batchId = deps.newId();
  return (await deps.goals.trash(scope, id, batchId, deps.clock.now()))
    ? ok({ batchId })
    : err(notFound());
}

export async function getGoal(
  deps: GoalDeps,
  scope: WorkspaceScope,
  id: string,
  options: { includeDeleted?: boolean } = {},
): Promise<Result<GoalWithProgress, DomainError>> {
  const allowed = authorize(scope, 'goal.read');
  if (!allowed.ok) return allowed;
  const goal = options.includeDeleted
    ? await deps.goals.findAny(scope, id)
    : await deps.goals.findById(scope, id);
  if (!goal) return err(notFound());
  const [result] = await withProgress(deps, scope, [goal]);
  return ok(result!);
}

/** Hedefler sayfası (USER_FLOWS §2.9): Aktif / Ulaşılan / Bırakılan sekmeleri. */
export async function listGoals(
  deps: GoalDeps,
  scope: WorkspaceScope,
  filter: GoalListFilter,
): Promise<Result<GoalWithProgress[], DomainError>> {
  const allowed = authorize(scope, 'goal.read');
  if (!allowed.ok) return allowed;
  return ok(await withProgress(deps, scope, await deps.goals.list(scope, filter)));
}
