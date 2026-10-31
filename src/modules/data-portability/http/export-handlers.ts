import { z } from 'zod';
import { rateLimited, verifyCurrentPassword } from '@/modules/identity';
import { recordAuditEvent } from '@/modules/audit';
import { findPersonalWorkspaceId, resolveWorkspaceScope } from '@/modules/workspaces';
import { db } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { systemClock } from '@/shared/kernel/clock';
import { uuidv7 } from '@/shared/kernel/id';
import { exportAccount } from '../application/export';
import { createSqlExportReader } from '../infrastructure/sql-export-reader';

const ExportBody = z.strictObject({ currentPassword: z.string().max(1000) });

/**
 * POST /me/export (API_CONTRACTS §14): şifreyle yeniden doğrulama (D-055), saatte 5 istek (SECURITY §8.3).
 * Yanıt doğrudan indirilen JSON dosyasıdır (D-046); sunucuda dosya saklanmaz.
 */
export async function postExport(ctx: ApiContext): Promise<Response> {
  const limited = await rateLimited(ctx, 'export', 5);
  if (limited) return limited;
  const body = await ctx.parse(ExportBody);
  if (!body.ok) return body.response;

  const workspaceId = await findPersonalWorkspaceId(db(), ctx.actor.userId);
  const scope = workspaceId
    ? await resolveWorkspaceScope(db(), ctx.actor.userId, workspaceId)
    : null;
  if (!scope) return ctx.fail({ kind: 'not_found' });

  const result = await db().transaction(
    (tx) =>
      exportAccount(
        {
          reader: createSqlExportReader(tx),
          clock: systemClock,
          verifyPassword: (password) => verifyCurrentPassword(ctx.request.headers, password),
        },
        { userId: scope.userId, workspaceId: scope.workspaceId },
        body.data,
      ),
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
  if (!result.ok) return ctx.fail(result.error);

  const now = systemClock.now();
  await recordAuditEvent(db(), {
    id: uuidv7(),
    action: 'account.export',
    actorUserId: scope.userId,
    workspaceId: scope.workspaceId,
    now,
  });
  const date = result.value.exportedAt.slice(0, 10);
  return new Response(JSON.stringify(result.value, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="aysly-export-${date}.json"`,
      'cache-control': 'no-store',
      'x-request-id': ctx.requestId,
    },
  });
}
