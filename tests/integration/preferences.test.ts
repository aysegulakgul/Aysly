import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerUser } from '@/modules/identity/application/register-user';
import { createDrizzleRegistrationStore } from '@/modules/identity/infrastructure/drizzle-registration-store';
import { updatePreferences } from '@/modules/preferences/application/update-preferences';
import { createDrizzlePreferencesStore } from '@/modules/preferences/infrastructure/drizzle-preferences-store';
import { createSqlClient, type Database } from '@/shared/db/client';
import * as schema from '@/shared/db/schema';
import { fixedClock } from '@/shared/kernel/clock';
import { uuidv7 } from '@/shared/kernel/id';
import { startTestDatabase } from '../fixtures/test-database';

let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let client: ReturnType<typeof createSqlClient>;
let database: Database;
const clock = fixedClock(new Date('2026-10-28T09:00:00Z'));

async function newUser(email: string): Promise<string> {
  const result = await registerUser(
    {
      store: createDrizzleRegistrationStore(database),
      hasher: { hash: async () => 'hash' },
      clock,
      newId: uuidv7,
    },
    {
      name: 'Test',
      email,
      password: 'ayisigi gece 2026',
      locale: 'tr',
      timezone: 'Europe/Istanbul',
    },
  );
  if (!result.ok) throw new Error('kayıt başarısız');
  return result.value.userId;
}

beforeAll(async () => {
  testDb = await startTestDatabase();
  client = createSqlClient(testDb.url, 5);
  database = drizzle(client, { schema });
});

beforeEach(async () => {
  await client`truncate users cascade`;
});

afterAll(async () => {
  await client?.end({ timeout: 5 });
  await testDb?.stop();
});

describe('tercihler (veritabanı)', () => {
  it('BR-PREF-001: kayıttaki varsayılanlar okunur; tema sistem, sürüm 1', async () => {
    const userId = await newUser('a@ornek.test');
    expect(await createDrizzlePreferencesStore(database).find(userId)).toEqual({
      locale: 'tr',
      timezone: 'Europe/Istanbul',
      theme: 'system',
      density: 'comfortable',
      dateFormat: 'DD.MM.YYYY',
      timeFormat: '24h',
      weekStart: 1,
      version: 1,
    });
  });

  it('BR-PREF-002: güncelleme yalnızca aktörün kaydını değiştirir; değişiklik kalıcıdır', async () => {
    const a = await newUser('a@ornek.test');
    const b = await newUser('b@ornek.test');
    const store = createDrizzlePreferencesStore(database);
    const result = await updatePreferences(
      { store, clock },
      { userId: a },
      {
        version: 1,
        changes: { theme: 'light', locale: 'en', timezone: 'America/New_York' },
      },
    );
    expect(result.ok).toBe(true);
    expect(await store.find(a)).toMatchObject({
      theme: 'light',
      locale: 'en',
      timezone: 'America/New_York',
      version: 2,
    });
    expect(await store.find(b)).toMatchObject({ theme: 'system', locale: 'tr', version: 1 });
  });

  it('aynı sürümle iki eşzamanlı güncellemeden yalnızca biri uygulanır, diğeri çakışma alır', async () => {
    const userId = await newUser('a@ornek.test');
    const store = createDrizzlePreferencesStore(database);
    const results = await Promise.all([
      updatePreferences({ store, clock }, { userId }, { version: 1, changes: { theme: 'dark' } }),
      updatePreferences({ store, clock }, { userId }, { version: 1, changes: { theme: 'light' } }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const conflict = results.find((r) => !r.ok);
    expect(conflict).toMatchObject({ ok: false, error: { kind: 'version_conflict' } });
    expect((await store.find(userId))?.version).toBe(2);
  });

  it('veritabanı izinli olmayan değeri reddeder (CHECK kısıtı)', async () => {
    const userId = await newUser('a@ornek.test');
    await expect(
      client`update user_preferences set theme = 'neon' where user_id = ${userId}`,
    ).rejects.toThrow();
  });
});
