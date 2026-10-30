import { findPersonalWorkspaceId, resolveWorkspaceScope } from '@/modules/workspaces';
import { db } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { SEARCH_TYPES, searchEverything, type SearchType } from '../application/search';
import { createSqlSearchIndex } from '../infrastructure/sql-search-index';

/**
 * GET /search?q=&types=task,project,note,goal&includeArchived= (API_CONTRACTS §11). Erişilebilir alan MVP'de
 * kişisel alandır (BR-WS-001); sonuçlar türe göre gruplu döner.
 */
export async function getSearch(ctx: ApiContext): Promise<Response> {
  const query = new URL(ctx.request.url).searchParams;
  const types = (query.get('types') ?? '')
    .split(',')
    .filter((t): t is SearchType => (SEARCH_TYPES as readonly string[]).includes(t));
  const workspaceId = await findPersonalWorkspaceId(db(), ctx.actor.userId);
  const scope = workspaceId
    ? await resolveWorkspaceScope(db(), ctx.actor.userId, workspaceId)
    : null;
  if (!scope) return ctx.json(200, { data: [] });
  const result = await searchEverything(createSqlSearchIndex(db()), scope, {
    q: query.get('q') ?? '',
    types,
    includeArchived: query.get('includeArchived') === 'true',
  });
  return result.ok ? ctx.json(200, { data: result.value }) : ctx.fail(result.error);
}
