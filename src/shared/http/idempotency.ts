import { createHash } from 'node:crypto';
import { and, eq, lt, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db, type Database, type DbTransaction } from '@/shared/db/client';
import type { JobDefinition } from '@/shared/jobs/scheduler';
import type { ApiContext } from './api-route';
import { idempotencyKeys } from './idempotency-schema';
import { REQUEST_ID_HEADER } from './request-id';

export const IDEMPOTENCY_HEADER = 'idempotency-key';
const TTL_MS = 24 * 60 * 60 * 1000; // D-019
const KEY_RE = /^[\w-]{8,200}$/;

type Outcome = { status: number; body: unknown };

/** 2xx olmayan sonuçlar kaydedilmez: işlem geri alınır ki istemci düzeltilmiş gövdeyle aynı anahtarı kullanabilsin. */
class NotStored extends Error {
  constructor(readonly outcome: Outcome) {
    super('idempotency: başarısız sonuç saklanmaz');
  }
}

/**
 * BR-TASK-007 / D-019: oluşturma istekleri `Idempotency-Key` başlığı taşır. Aynı kullanıcı + anahtar için 24 saat
 * içinde ilk başarılı yanıt aynen döner; gövde farklıysa `422 IDEMPOTENCY_KEY_REUSED`.
 *
 * Eşzamanlılık: anahtar satırı işlemin içinde eklenir; aynı anahtarlı ikinci istek birincinin bitmesini birincil
 * anahtar kilidinde bekler, sonra kaydedilmiş yanıtı okur. Böylece iki eşzamanlı istekten tek kayıt oluşur.
 */
export async function idempotent(
  ctx: ApiContext,
  body: unknown,
  run: (tx: DbTransaction) => Promise<Outcome>,
  database: Database = db(),
): Promise<Response> {
  const key = ctx.request.headers.get(IDEMPOTENCY_HEADER);
  if (!key || !KEY_RE.test(key)) {
    return ctx.fail({
      kind: 'validation',
      issues: [{ field: 'Idempotency-Key', reason: key ? 'invalid' : 'required' }],
    });
  }
  const url = new URL(ctx.request.url);
  const hash = createHash('sha256')
    .update(`${ctx.request.method} ${url.pathname}\n${JSON.stringify(body)}`)
    .digest('hex');
  const userId = ctx.actor.userId;

  let outcome: Outcome;
  try {
    outcome = await database.transaction(async (tx) => {
      // Süresi dolmuş kayıt (temizlik işi henüz çalışmadıysa) yok sayılır.
      await tx
        .delete(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.userId, userId),
            eq(idempotencyKeys.key, key),
            lt(idempotencyKeys.createdAt, sql`now() - interval '24 hours'`),
          ),
        );
      const inserted = await tx
        .insert(idempotencyKeys)
        .values({ userId, key, requestHash: hash, responseStatus: 0 })
        .onConflictDoNothing()
        .returning({ key: idempotencyKeys.key });

      if (inserted.length === 0) {
        const [previous] = await tx
          .select()
          .from(idempotencyKeys)
          .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)));
        if (!previous || previous.requestHash !== hash) {
          return {
            status: 422,
            body: {
              error: {
                code: 'IDEMPOTENCY_KEY_REUSED',
                message: ctx.t('errors.idempotencyReused'),
                requestId: ctx.requestId,
              },
            },
          };
        }
        return { status: previous.responseStatus, body: previous.responseBody };
      }

      const result = await run(tx);
      if (result.status < 200 || result.status >= 300) throw new NotStored(result);
      await tx
        .update(idempotencyKeys)
        .set({ responseStatus: result.status, responseBody: result.body })
        .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)));
      return result;
    });
  } catch (error) {
    if (error instanceof NotStored) outcome = error.outcome;
    else throw error;
  }
  return NextResponse.json(outcome.body, {
    status: outcome.status,
    headers: { [REQUEST_ID_HEADER]: ctx.requestId },
  });
}

/** D-019 / D-053: 24 saatten eski kayıtların temizliği (uygulama çalışırken saatlik). */
export function idempotencyCleanupJob(database: () => Database = db): JobDefinition {
  return {
    name: 'idempotency.cleanup',
    intervalMs: 60 * 60 * 1000,
    run: async () => {
      await database()
        .delete(idempotencyKeys)
        .where(lt(idempotencyKeys.createdAt, new Date(Date.now() - TTL_MS)));
    },
  };
}
