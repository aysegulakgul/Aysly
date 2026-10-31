import { describe, expect, it } from 'vitest';
import { fixedClock } from '@/shared/kernel/clock';
import {
  deletionDueAt,
  purgeDueAccounts,
  requestAccountDeletion,
  type DeletionStore,
} from './account-deletion';

const now = new Date('2026-10-30T09:00:00Z');

function memoryStore(requested: Record<string, Date> = {}) {
  const calls: string[] = [];
  const store: DeletionStore = {
    async markDeletionRequested(userId, at) {
      requested[userId] ??= at;
      return requested[userId];
    },
    async clearDeletionRequest(userId) {
      delete requested[userId];
    },
    async deleteAllSessions(userId) {
      calls.push(`sessions:${userId}`);
    },
    async listDueDeletions(before) {
      return Object.keys(requested).filter((id) => requested[id]! <= before);
    },
    async purgeUser(userId) {
      calls.push(`purge:${userId}`);
      delete requested[userId];
      return true;
    },
  };
  return { store, calls, requested };
}

describe('hesap silme (BR-ACC-005)', () => {
  it('BR-ACC-005: silme 14 gün sonra; tekrar talep ilk talebin tarihini korur', async () => {
    const { store, calls } = memoryStore({ u: new Date('2026-10-28T09:00:00Z') });
    const result = await requestAccountDeletion(
      { store, clock: fixedClock(now), verifyPassword: async () => true },
      { userId: 'u' },
      { currentPassword: 'x' },
    );
    expect(result).toEqual({ ok: true, value: { scheduledFor: new Date('2026-11-11T09:00:00Z') } });
    expect(calls).toEqual(['sessions:u']);
    expect(deletionDueAt(now).toISOString()).toBe('2026-11-13T09:00:00.000Z');
  });

  it('D-055: yanlış şifrede işaretlenmez ve oturumlar kapanmaz', async () => {
    const { store, calls, requested } = memoryStore();
    const result = await requestAccountDeletion(
      { store, clock: fixedClock(now), verifyPassword: async () => false },
      { userId: 'u' },
      { currentPassword: 'yanlis' },
    );
    expect(result).toMatchObject({ ok: false, error: { kind: 'validation' } });
    expect(calls).toEqual([]);
    expect(requested).toEqual({});
  });

  it('BR-ACC-005: yalnızca süresi dolan talepler silinir', async () => {
    const { store, calls } = memoryStore({
      dolan: new Date('2026-10-16T08:59:00Z'),
      dolmayan: new Date('2026-10-20T09:00:00Z'),
    });
    expect(await purgeDueAccounts({ store, clock: fixedClock(now) })).toBe(1);
    expect(calls).toEqual(['purge:dolan']);
  });
});
