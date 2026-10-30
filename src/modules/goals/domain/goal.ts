import type { FieldIssue } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';

export const GOAL_STATUSES = ['active', 'achieved', 'abandoned'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];
export const PROGRESS_MODES = ['auto', 'manual'] as const;
export type ProgressMode = (typeof PROGRESS_MODES)[number];
export const LINKS_PER_GOAL = 100;

export type Goal = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: GoalStatus;
  progressMode: ProgressMode;
  /** BR-GOAL-002: mod değişse de saklanır (geri dönülebilir). */
  manualProgress: number | null;
  achievedAt: Date | null;
  archivedAt: Date | null;
  deletedAt: Date | null;
  deletedBatchId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

/** BR-GOAL-001: başlık 1–200 karakter, kırpılmış. */
export function normalizeGoalTitle(raw: string): Result<string, FieldIssue> {
  const title = raw.replace(/[\r\n]+/g, ' ').trim();
  if (title.length === 0) return err({ field: 'title', reason: 'required' });
  if (title.length > 200) return err({ field: 'title', reason: 'too_long' });
  return ok(title);
}

export function checkGoalDescription(description: string | null): FieldIssue[] {
  return description !== null && description.length > 5000
    ? [{ field: 'description', reason: 'too_long' }]
    : [];
}

/**
 * BR-GOAL-002: hedef ilerlemesi. Otomatikte bağlı görevlerin tamamlanma oranı (bağlı kayıt yoksa gösterilmez);
 * manuelde kullanıcının girdiği 0–100 değer.
 */
export type GoalProgress =
  | { mode: 'auto'; done: number; total: number; percent: number | null }
  | { mode: 'manual'; percent: number | null };

export function goalProgress(goal: Goal, counts: { done: number; total: number }): GoalProgress {
  if (goal.progressMode === 'manual') return { mode: 'manual', percent: goal.manualProgress };
  return {
    mode: 'auto',
    ...counts,
    percent: counts.total === 0 ? null : Math.round((counts.done / counts.total) * 100),
  };
}

/** BR-GOAL-003: otomatik ilerleme %100'e ulaşınca hedef kendiliğinden "Ulaşıldı" olmaz; yalnızca önerilir. */
export const suggestAchieved = (goal: Goal, progress: GoalProgress) =>
  goal.status === 'active' && progress.mode === 'auto' && progress.percent === 100;
