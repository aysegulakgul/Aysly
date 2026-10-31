import { z } from 'zod';
import { env } from '@/shared/config/env';
import { db } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import type { JobDefinition } from '@/shared/jobs/scheduler';
import { logger } from '@/shared/observability/logger';
import { systemClock } from '@/shared/kernel/clock';
import { isUuid, uuidv7 } from '@/shared/kernel/id';
import { recordAuditEvent } from '@/modules/audit';
import {
  changePassword,
  listSessions,
  requestEmailChange,
  revokeOtherSessions,
  revokeSession,
  updateProfile,
} from '../application/account';
import {
  cancelAccountDeletion,
  purgeDueAccounts,
  requestAccountDeletion,
} from '../application/account-deletion';
import { createBetterAuthCredentials } from '../infrastructure/better-auth-credentials';
import { createDrizzleDeletionStore } from '../infrastructure/drizzle-deletion-store';
import { createDrizzleAccountStore } from '../infrastructure/drizzle-account-store';
import { consumeRateLimit } from '../infrastructure/rate-limiter';

/** API_CONTRACTS §3: /me uç noktaları. Gövdeler katıdır; bilinmeyen alan reddedilir (§2.6). */
const PatchMeBody = z.strictObject({ name: z.string().max(1000) });
const ChangePasswordBody = z.strictObject({
  currentPassword: z.string().max(1000),
  newPassword: z.string().max(1000),
});
const ChangeEmailBody = z.strictObject({
  newEmail: z.string().max(1000),
  currentPassword: z.string().max(1000),
});

const DeletionBody = z.strictObject({ currentPassword: z.string().max(1000) });

const deps = () => ({ store: createDrizzleAccountStore(db()), clock: systemClock });

/** SECURITY §4.4: kullanıcı başına sınır (varsayılan saatlik); aşılırsa 429 yanıtı, değilse null. */
export async function rateLimited(
  ctx: ApiContext,
  action: string,
  max: number,
  windowSeconds = 3600,
) {
  if (!env().AUTH_RATE_LIMIT_ENABLED) return null;
  const limit = await consumeRateLimit(db(), {
    key: `${action}:${ctx.actor.userId}`,
    windowSeconds,
    max,
    nowMs: Date.now(),
  });
  if (limit.allowed) return null;
  return ctx.json(
    429,
    {
      error: {
        code: 'RATE_LIMITED',
        message: ctx.t('errors.rateLimited'),
        requestId: ctx.requestId,
      },
    },
    { 'Retry-After': String(limit.retryAfterSeconds) },
  );
}

export async function patchMe(ctx: ApiContext): Promise<Response> {
  const body = await ctx.parse(PatchMeBody);
  if (!body.ok) return body.response;
  const result = await updateProfile(deps(), ctx.actor, body.data);
  return result.ok ? ctx.json(200, { data: result.value }) : ctx.fail(result.error);
}

export async function postPassword(ctx: ApiContext): Promise<Response> {
  const limited = await rateLimited(ctx, 'change-password', 5);
  if (limited) return limited;
  const body = await ctx.parse(ChangePasswordBody);
  if (!body.ok) return body.response;
  const credentials = createBetterAuthCredentials(ctx.request.headers);
  const result = await changePassword(credentials, body.data);
  if (!result.ok) return ctx.fail(result.error);
  // BR-ACC-006: diğer oturumlar kapandı; bu cihaz için yeni oturum çerezi verilir.
  const response = new Response(null, { status: 204 });
  for (const cookie of credentials.setCookies) response.headers.append('set-cookie', cookie);
  return response;
}

export async function postEmail(ctx: ApiContext): Promise<Response> {
  const limited = await rateLimited(ctx, 'change-email', 3);
  if (limited) return limited;
  const body = await ctx.parse(ChangeEmailBody);
  if (!body.ok) return body.response;
  const result = await requestEmailChange(
    deps(),
    createBetterAuthCredentials(ctx.request.headers),
    ctx.actor,
    body.data,
  );
  return result.ok
    ? ctx.json(202, { data: { status: 'verification_sent' } })
    : ctx.fail(result.error);
}

export async function getSessions(ctx: ApiContext): Promise<Response> {
  return ctx.json(200, { data: await listSessions(deps(), ctx.actor) });
}

/** DELETE /me/sessions?others=true — diğer tüm oturumları kapatır. */
export async function deleteSessions(ctx: ApiContext): Promise<Response> {
  if (new URL(ctx.request.url).searchParams.get('others') !== 'true') {
    return ctx.fail({ kind: 'validation', issues: [{ field: 'others', reason: 'required' }] });
  }
  await revokeOtherSessions(deps(), ctx.actor);
  return new Response(null, { status: 204 });
}

export async function deleteSession(ctx: ApiContext): Promise<Response> {
  const id = ctx.params.id ?? '';
  // Geçersiz kimlik de bulunamadı sayılır (BR-PERM-001).
  if (!isUuid(id)) return ctx.fail({ kind: 'not_found' });
  const result = await revokeSession(deps(), ctx.actor, id);
  return result.ok ? new Response(null, { status: 204 }) : ctx.fail(result.error);
}

/** Ayarlar · Güvenlik sayfası (sunucu bileşeni) için oturum listesi; uç noktayla aynı use case. */
export function findActiveSessions(actor: { userId: string; sessionId: string }) {
  return listSessions(deps(), actor);
}

/** D-055: dışa aktarma ve hesap silme gibi işlemler için isteğin oturumuyla şifreyle yeniden doğrulama. */
export function verifyCurrentPassword(headers: Headers, password: string): Promise<boolean> {
  return createBetterAuthCredentials(headers).verifyPassword(password);
}

const deletionDeps = (headers: Headers) => ({
  store: createDrizzleDeletionStore(db()),
  clock: systemClock,
  verifyPassword: (password: string) =>
    createBetterAuthCredentials(headers).verifyPassword(password),
});

/** POST /me/deletion (API_CONTRACTS §3): BR-ACC-005, şifreyle yeniden doğrulama (D-055), günde 3 istek. */
export async function postDeletion(ctx: ApiContext): Promise<Response> {
  const limited = await rateLimited(ctx, 'account-deletion', 3, 24 * 3600);
  if (limited) return limited;
  const body = await ctx.parse(DeletionBody);
  if (!body.ok) return body.response;
  const result = await requestAccountDeletion(
    deletionDeps(ctx.request.headers),
    ctx.actor,
    body.data,
  );
  if (!result.ok) return ctx.fail(result.error);
  await recordAuditEvent(db(), {
    id: uuidv7(),
    action: 'account.deletion_requested',
    actorUserId: ctx.actor.userId,
    now: systemClock.now(),
  });
  return ctx.json(202, { data: { scheduledFor: result.value.scheduledFor.toISOString() } });
}

/** DELETE /me/deletion: BR-ACC-005 / D-092 — 14 gün içinde talep iptal edilir. */
export async function deleteDeletion(ctx: ApiContext): Promise<Response> {
  await cancelAccountDeletion(deletionDeps(ctx.request.headers), ctx.actor);
  await recordAuditEvent(db(), {
    id: uuidv7(),
    action: 'account.deletion_cancelled',
    actorUserId: ctx.actor.userId,
    now: systemClock.now(),
  });
  return new Response(null, { status: 204 });
}

/** BR-ACC-005 / D-053: 14 günü dolan silme talepleri saatlik uygulanır; açılışta da çalışır. */
export function accountDeletionJob(): JobDefinition {
  return {
    name: 'accounts.purge',
    intervalMs: 60 * 60 * 1000,
    run: async () => {
      const purged = await purgeDueAccounts({
        store: createDrizzleDeletionStore(db()),
        clock: systemClock,
      });
      if (purged > 0) logger().info({ purged }, 'süresi dolan hesaplar silindi');
    },
  };
}
