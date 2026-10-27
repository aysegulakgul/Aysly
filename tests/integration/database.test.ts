import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSqlClient } from '@/shared/db/client';
import { isDatabaseReachable } from '@/shared/db/health';
import { runMigrations } from '@/shared/db/migrate';
import { createPgAdvisoryLock } from '@/shared/jobs/pg-advisory-lock';
import { startTestDatabase } from '../fixtures/test-database';

let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let sql: ReturnType<typeof createSqlClient>;

beforeAll(async () => {
  testDb = await startTestDatabase();
  sql = createSqlClient(testDb.url, 5);
});

afterAll(async () => {
  await sql?.end({ timeout: 5 });
  await testDb?.stop();
});

describe('veritabanı altyapısı', () => {
  it('migration boş veritabanına uygulanır ve arama uzantıları kurulur (D-022)', async () => {
    const rows = await sql<
      { extname: string }[]
    >`select extname from pg_extension order by extname`;
    expect(rows.map((r) => r.extname)).toEqual(expect.arrayContaining(['pg_trgm', 'unaccent']));
  });

  it('migration tekrar çalıştırıldığında hiçbir şey değişmez (idempotent)', async () => {
    await runMigrations(testDb.url);
    const [row] = await sql<
      { count: number }[]
    >`select count(*)::int as count from drizzle.__drizzle_migrations`;
    expect(row?.count).toBe(1);
  });

  it('oturum saat dilimi UTC (DATA_MODEL §6)', async () => {
    const [row] = await sql<{ TimeZone: string }[]>`show timezone`;
    expect(row?.TimeZone).toBe('UTC');
  });

  it('unaccent Türkçe karakterleri sadeleştirir (BR-SRCH-001 temeli)', async () => {
    const [row] = await sql<{ v: string }[]>`select lower(unaccent('Işık Çiçek Güneş')) as v`;
    expect(row?.v).toBe('isik cicek gunes');
  });

  it('sağlık kontrolü erişilebilir veritabanında true döner', async () => {
    expect(await isDatabaseReachable(drizzle(sql))).toBe(true);
  });
});

describe('bakım işleri için veritabanı kilidi (D-053)', () => {
  it('aynı iş aynı anda yalnızca bir kez çalışır; diğeri atlanır', async () => {
    const lock = createPgAdvisoryLock(sql);
    let running = 0;
    let maxConcurrent = 0;
    const job = async () => {
      running++;
      maxConcurrent = Math.max(maxConcurrent, running);
      await new Promise((resolve) => setTimeout(resolve, 300));
      running--;
    };
    const outcomes = await Promise.all([lock.withLock('ornek', job), lock.withLock('ornek', job)]);
    expect(outcomes.sort()).toEqual(['ran', 'skipped']);
    expect(maxConcurrent).toBe(1);
  });

  it('farklı adlı işler birbirini engellemez', async () => {
    const lock = createPgAdvisoryLock(sql);
    const slow = () => new Promise<void>((resolve) => setTimeout(resolve, 200));
    const outcomes = await Promise.all([lock.withLock('a', slow), lock.withLock('b', slow)]);
    expect(outcomes).toEqual(['ran', 'ran']);
  });

  it('iş tamamlanınca kilit bırakılır', async () => {
    const lock = createPgAdvisoryLock(sql);
    expect(await lock.withLock('tekrar', async () => {})).toBe('ran');
    expect(await lock.withLock('tekrar', async () => {})).toBe('ran');
  });
});
