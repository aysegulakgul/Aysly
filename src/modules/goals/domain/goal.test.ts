import { describe, expect, it } from 'vitest';
import { goalProgress, normalizeGoalTitle, suggestAchieved, type Goal } from './goal';

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'g',
  workspaceId: 'w',
  title: 'Hedef',
  description: null,
  targetDate: null,
  status: 'active',
  progressMode: 'auto',
  manualProgress: null,
  achievedAt: null,
  archivedAt: null,
  deletedAt: null,
  deletedBatchId: null,
  version: 1,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...over,
});

describe('hedefler (BR-GOAL-001..003)', () => {
  it('BR-GOAL-001: başlık kırpılır, 1–200 karakter', () => {
    expect(normalizeGoalTitle('  Kitap\noku ')).toEqual({ ok: true, value: 'Kitap oku' });
    expect(normalizeGoalTitle('  ').ok).toBe(false);
    expect(normalizeGoalTitle('x'.repeat(201)).ok).toBe(false);
  });

  it('BR-GOAL-002: otomatikte oran, bağlı kayıt yoksa "—"; manuelde girilen değer', () => {
    expect(goalProgress(goal(), { done: 2, total: 6 })).toEqual({
      mode: 'auto',
      done: 2,
      total: 6,
      percent: 33,
    });
    expect(goalProgress(goal(), { done: 0, total: 0 }).percent).toBeNull();
    expect(
      goalProgress(goal({ progressMode: 'manual', manualProgress: 70 }), { done: 0, total: 4 }),
    ).toEqual({
      mode: 'manual',
      percent: 70,
    });
  });

  it('BR-GOAL-003: %100 olunca kendiliğinden "Ulaşıldı" olmaz, yalnızca önerilir', () => {
    const done = goalProgress(goal(), { done: 3, total: 3 });
    expect(suggestAchieved(goal(), done)).toBe(true);
    expect(suggestAchieved(goal({ status: 'achieved' }), done)).toBe(false);
    expect(suggestAchieved(goal(), goalProgress(goal(), { done: 2, total: 3 }))).toBe(false);
  });
});
