import { sql } from 'drizzle-orm';
import type { DbExecutor } from '@/shared/db/client';
import { uuidv7 } from '@/shared/kernel/id';

/**
 * PostgreSQL tabanlı sabit pencereli hız sınırı (SECURITY §4.4). Better Auth'un sayaç tablosunu
 * (`auth_rate_limits`) kendi anahtar önekiyle (`aysly:`) paylaşır. Tek SQL ifadesiyle atomik çalışır.
 */
export async function consumeRateLimit(
  db: DbExecutor,
  input: { key: string; windowSeconds: number; max: number; nowMs: number },
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const windowMs = input.windowSeconds * 1000;
  const key = `aysly:${input.key}`;
  const rows = await db.execute<{ count: number; last_request: string }>(sql`
    insert into auth_rate_limits (id, key, count, last_request)
    values (${uuidv7(input.nowMs)}, ${key}, 1, ${input.nowMs})
    on conflict (key) do update set
      count = case when auth_rate_limits.last_request <= ${input.nowMs - windowMs} then 1 else auth_rate_limits.count + 1 end,
      last_request = case when auth_rate_limits.last_request <= ${input.nowMs - windowMs} then ${input.nowMs} else auth_rate_limits.last_request end
    returning count, last_request
  `);
  const row = rows[0];
  const count = Number(row?.count ?? 1);
  const windowStart = Number(row?.last_request ?? input.nowMs);
  const allowed = count <= input.max;
  return {
    allowed,
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((windowStart + windowMs - input.nowMs) / 1000)),
  };
}
