import { sql } from 'drizzle-orm';
import type { DbExecutor } from '@/shared/db/client';
import { RESULTS_PER_TYPE, type SearchHit, type SearchIndex } from '../application/search';

/**
 * Arama okuma modeli (ARCHITECTURE §4.2.2: birden çok tabloyu okuyabilir, asla yazmaz). Tablolar adlarıyla
 * sorgulanır; her sorgu `workspace_id` ile kapsamlıdır ve çöpteki kayıtları dışlar (BR-SRCH-001).
 */
export function createSqlSearchIndex(db: DbExecutor): SearchIndex {
  return {
    async search(scope, query) {
      const ws = scope.workspaceId;
      const tsq = sql`to_tsquery('simple', aysly_search_text(${query.prefix}))`;
      // Etiket adı eşleşmesi: normalleştirilmiş ad sorgunun önekiyle başlıyorsa (BR-SRCH-001).
      const tagLike = sql`aysly_search_text(${query.text}) || '%'`;
      const archived = query.includeArchived;
      const hits: SearchHit[] = [];
      const run = async (statement: ReturnType<typeof sql>) =>
        (await db.execute(statement)) as unknown as {
          id: string;
          title: string;
          context: string | null;
          archived: boolean;
        }[];

      if (query.types.includes('task')) {
        const rows = await run(sql`
          select t.id, t.title, p.name as context, (t.archived_at is not null or p.archived_at is not null) as archived
          from tasks t join projects p on p.id = t.project_id and p.workspace_id = t.workspace_id
          where t.workspace_id = ${ws} and t.deleted_at is null and p.deleted_at is null
            and (${archived} or (t.archived_at is null and p.archived_at is null))
            and (t.search_vector @@ ${tsq} or exists (
              select 1 from task_tags tt join tags g on g.id = tt.tag_id
              where tt.task_id = t.id and aysly_search_text(g.name) like ${tagLike}))
          order by ts_rank(t.search_vector, ${tsq}) desc, t.updated_at desc
          limit ${RESULTS_PER_TYPE}`);
        hits.push(...rows.map((r) => ({ type: 'task' as const, ...r })));
      }
      if (query.types.includes('project')) {
        const rows = await run(sql`
          select p.id, p.name as title, p.status as context, (p.archived_at is not null) as archived
          from projects p
          where p.workspace_id = ${ws} and p.deleted_at is null and p.kind = 'standard'
            and (${archived} or p.archived_at is null) and p.search_vector @@ ${tsq}
          order by ts_rank(p.search_vector, ${tsq}) desc, p.updated_at desc
          limit ${RESULTS_PER_TYPE}`);
        hits.push(...rows.map((r) => ({ type: 'project' as const, ...r })));
      }
      if (query.types.includes('note')) {
        const rows = await run(sql`
          select n.id, coalesce(n.title, left(n.body, 80)) as title, left(n.body, 140) as context,
            (n.archived_at is not null) as archived
          from notes n
          where n.workspace_id = ${ws} and n.deleted_at is null and (${archived} or n.archived_at is null)
            and (n.search_vector @@ ${tsq} or exists (
              select 1 from note_tags nt join tags g on g.id = nt.tag_id
              where nt.note_id = n.id and aysly_search_text(g.name) like ${tagLike}))
          order by ts_rank(n.search_vector, ${tsq}) desc, n.updated_at desc
          limit ${RESULTS_PER_TYPE}`);
        hits.push(...rows.map((r) => ({ type: 'note' as const, ...r })));
      }
      if (query.types.includes('goal')) {
        const rows = await run(sql`
          select g.id, g.title, g.status as context, (g.archived_at is not null) as archived
          from goals g
          where g.workspace_id = ${ws} and g.deleted_at is null and (${archived} or g.archived_at is null)
            and g.search_vector @@ ${tsq}
          order by ts_rank(g.search_vector, ${tsq}) desc, g.updated_at desc
          limit ${RESULTS_PER_TYPE}`);
        hits.push(...rows.map((r) => ({ type: 'goal' as const, ...r })));
      }
      return hits;
    },
  };
}
