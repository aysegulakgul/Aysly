import { authorize, resolveWorkspaceScope } from '@/modules/workspaces';
import { db } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { listTags } from '../infrastructure/tag-store';

/** GET /workspaces/{ws}/tags (API_CONTRACTS §7): etiket önerileri için ada göre sıralı liste. */
export async function getTags(ctx: ApiContext): Promise<Response> {
  const scope = await resolveWorkspaceScope(db(), ctx.actor.userId, ctx.params.ws ?? '');
  if (!scope) return ctx.fail({ kind: 'not_found' });
  const allowed = authorize(scope, 'task.read');
  if (!allowed.ok) return ctx.fail(allowed.error);
  return ctx.json(200, { data: await listTags(db(), scope) });
}
