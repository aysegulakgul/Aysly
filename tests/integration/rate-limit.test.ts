import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { consumeRateLimit } from '@/modules/identity/infrastructure/rate-limiter';
import { createSqlClient } from '@/shared/db/client';
import * as schema from '@/shared/db/schema';
import { startTestDatabase } from '../fixtures/test-database';

let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let client: ReturnType<typeof createSqlClient>;

beforeAll(async () => {
  testDb = await startTestDatabase();
  client = createSqlClient(testDb.url, 10);
});
afterAll(async () => {
  await client?.end({ timeout: 5 });
  await testDb?.stop();
});

describe('hız sınırı (SECURITY §4.4)', () => {
  it('pencere içinde sınırı aşan istek reddedilir ve bekleme süresi döner', async () => {
    const db = drizzle(client, { schema });
    const t0 = 1_800_000_000_000;
    const results = [];
    for (let i = 0; i < 6; i++)
      results.push(
        await consumeRateLimit(db, {
          key: 'sign-up:a',
          windowSeconds: 3600,
          max: 5,
          nowMs: t0 + i,
        }),
      );
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, true, true, false]);
    expect(results[5]!.retryAfterSeconds).toBeGreaterThan(3500);
  });

  it('pencere dolunca sayaç sıfırlanır', async () => {
    const db = drizzle(client, { schema });
    const t0 = 1_800_000_100_000;
    for (let i = 0; i < 5; i++)
      await consumeRateLimit(db, { key: 'sign-up:b', windowSeconds: 60, max: 5, nowMs: t0 });
    expect(
      (await consumeRateLimit(db, { key: 'sign-up:b', windowSeconds: 60, max: 5, nowMs: t0 + 1 }))
        .allowed,
    ).toBe(false);
    expect(
      (
        await consumeRateLimit(db, {
          key: 'sign-up:b',
          windowSeconds: 60,
          max: 5,
          nowMs: t0 + 61_000,
        })
      ).allowed,
    ).toBe(true);
  });

  it('eşzamanlı isteklerde sayaç kaybolmaz (atomik)', async () => {
    const db = drizzle(client, { schema });
    const t0 = 1_800_000_200_000;
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        consumeRateLimit(db, { key: 'sign-up:c', windowSeconds: 3600, max: 5, nowMs: t0 }),
      ),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it('farklı anahtarlar birbirini etkilemez', async () => {
    const db = drizzle(client, { schema });
    const t0 = 1_800_000_300_000;
    for (let i = 0; i < 5; i++)
      await consumeRateLimit(db, { key: 'sign-up:d', windowSeconds: 3600, max: 5, nowMs: t0 });
    expect(
      (await consumeRateLimit(db, { key: 'sign-up:e', windowSeconds: 3600, max: 5, nowMs: t0 }))
        .allowed,
    ).toBe(true);
  });
});
