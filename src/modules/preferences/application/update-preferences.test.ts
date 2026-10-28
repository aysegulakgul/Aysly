import { describe, expect, it } from 'vitest';
import { fixedClock } from '@/shared/kernel/clock';
import type { Preferences } from '../domain/preferences';
import { updatePreferences, type PreferencesStore } from './update-preferences';

const base: Preferences = {
  locale: 'tr',
  timezone: 'Europe/Istanbul',
  theme: 'system',
  density: 'comfortable',
  dateFormat: 'DD.MM.YYYY',
  timeFormat: '24h',
  weekStart: 1,
  version: 1,
};

/** Bellekte, kullanıcı başına tek kayıt tutan sahte depo. */
function memoryStore(rows: Record<string, Preferences>): PreferencesStore {
  return {
    find: async (userId) => rows[userId] ?? null,
    update: async (userId, expectedVersion, changes) => {
      const row = rows[userId];
      if (!row || row.version !== expectedVersion) return null;
      const defined = Object.fromEntries(
        Object.entries(changes).filter(([, v]) => v !== undefined),
      );
      rows[userId] = { ...row, ...defined, version: row.version + 1 };
      return rows[userId];
    },
  };
}

const deps = (store: PreferencesStore) => ({ store, clock: fixedClock(new Date('2026-10-28')) });

describe('updatePreferences', () => {
  it('BR-PREF-003: tema ve dil değişir, sürüm artar', async () => {
    const store = memoryStore({ a: { ...base } });
    const result = await updatePreferences(
      deps(store),
      { userId: 'a' },
      {
        version: 1,
        changes: { theme: 'dark', locale: 'en' },
      },
    );
    expect(result).toEqual({
      ok: true,
      value: { ...base, theme: 'dark', locale: 'en', version: 2 },
    });
  });

  it('BR-PREF-001: geçersiz saat dilimi reddedilir ve hiçbir şey yazılmaz', async () => {
    const rows = { a: { ...base } };
    const result = await updatePreferences(
      deps(memoryStore(rows)),
      { userId: 'a' },
      {
        version: 1,
        changes: { timezone: 'Mars/Olympus', theme: 'dark' },
      },
    );
    expect(result).toEqual({
      ok: false,
      error: { kind: 'validation', issues: [{ field: 'timezone', reason: 'invalid' }] },
    });
    expect(rows.a.theme).toBe('system');
  });

  it('eski sürümle güncelleme 409 için güncel kaydı döner', async () => {
    const store = memoryStore({ a: { ...base, version: 3 } });
    const result = await updatePreferences(
      deps(store),
      { userId: 'a' },
      {
        version: 2,
        changes: { theme: 'light' },
      },
    );
    expect(result).toEqual({
      ok: false,
      error: { kind: 'version_conflict', current: { ...base, version: 3 } },
    });
  });

  it('BR-PREF-002: aktör yalnızca kendi tercihini değiştirir; kaydı yoksa bulunamadı', async () => {
    const rows = { b: { ...base } };
    const result = await updatePreferences(
      deps(memoryStore(rows)),
      { userId: 'a' },
      {
        version: 1,
        changes: { theme: 'dark' },
      },
    );
    expect(result).toEqual({ ok: false, error: { kind: 'not_found' } });
    expect(rows.b.theme).toBe('system');
  });
});
