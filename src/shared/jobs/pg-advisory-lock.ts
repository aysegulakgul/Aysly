import { createHash } from 'node:crypto';
import type postgres from 'postgres';
import type { JobLock } from './scheduler';

/** İş adından kararlı bir 64 bit kilit anahtarı üretir. */
export function lockKey(name: string): bigint {
  return createHash('sha256').update(`aysly:job:${name}`).digest().readBigInt64BE(0);
}

/**
 * PostgreSQL oturum düzeyi advisory lock ile tek çalışma garantisi.
 * Kilit alınamazsa iş atlanır (başka bir süreç çalıştırıyordur).
 */
export function createPgAdvisoryLock(sql: postgres.Sql): JobLock {
  return {
    async withLock(name, fn) {
      const key = lockKey(name).toString();
      return sql.begin(async (tx) => {
        const [row] = await tx<
          { locked: boolean }[]
        >`select pg_try_advisory_xact_lock(${key}::bigint) as locked`;
        if (!row?.locked) return 'skipped' as const;
        await fn();
        return 'ran' as const;
      });
    },
  };
}
