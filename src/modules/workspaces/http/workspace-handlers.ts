import { db } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { listMemberships } from '../infrastructure/membership';

/** API_CONTRACTS §4: GET /workspaces — aktörün üye olduğu alanlar. */
export async function getWorkspaces(ctx: ApiContext): Promise<Response> {
  return ctx.json(200, { data: await listMemberships(db(), ctx.actor.userId) });
}
