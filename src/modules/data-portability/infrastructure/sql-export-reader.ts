import { sql } from 'drizzle-orm';
import type { DbExecutor } from '@/shared/db/client';
import type { ExportData, ExportReader } from '../application/export';

/**
 * Çalışma alanı içerik tabloları. Her satır `workspace_id` ile süzülür; arama kolonu (`search_vector`) ve tekrarlanan
 * `workspace_id` çıkarılır. Yeni bir içerik tablosu eklenince buraya da eklenir (TESTING_STRATEGY: dışa aktarma testi).
 */
const CONTENT_TABLES = [
  'projects',
  'tasks',
  'tags',
  'task_tags',
  'saved_views',
  'reminders',
  'notes',
  'note_tags',
  'note_task_links',
  'note_project_links',
  'goals',
  'goal_task_links',
  'goal_project_links',
  'contacts',
  'task_comments',
] as const;

type Rows = { rows: Record<string, unknown>[] };

/** D-059 kapsamında okuma modeli (ham SQL, search modülündeki gibi). Tek işlemde, tutarlı bir anlık görüntü. */
export function createSqlExportReader(db: DbExecutor): ExportReader {
  const one = async (query: ReturnType<typeof sql>) =>
    (await db.execute<{ row: Record<string, unknown> | null }>(query))[0]?.row ?? null;
  const many = async (query: ReturnType<typeof sql>) =>
    (await db.execute<Rows>(query))[0]?.rows ?? [];

  return {
    async read(userId, workspaceId): Promise<ExportData> {
      const profile = await one(sql`
        select jsonb_build_object('name', name, 'email', email, 'email_verified', email_verified,
          'created_at', created_at) as row
        from users where id = ${userId}`);
      const preferences = await one(sql`
        select to_jsonb(p) - 'user_id' as row from user_preferences p where user_id = ${userId}`);
      const workspace = await one(sql`
        select jsonb_build_object('id', id, 'type', type, 'name', name, 'created_at', created_at) as row
        from workspaces where id = ${workspaceId}`);

      const content: Record<string, Record<string, unknown>[]> = {};
      for (const table of CONTENT_TABLES) {
        content[table] = await many(sql`
          select coalesce(jsonb_agg(to_jsonb(t) - 'search_vector' - 'workspace_id'), '[]'::jsonb) as rows
          from ${sql.identifier(table)} t where t.workspace_id = ${workspaceId}`);
      }
      // Bildirimler kişiye aittir; yalnızca aktörün bu alandaki bildirimleri.
      content.notifications = await many(sql`
        select coalesce(jsonb_agg(to_jsonb(n) - 'workspace_id' - 'user_id' - 'dedupe_key'), '[]'::jsonb) as rows
        from notifications n where n.workspace_id = ${workspaceId} and n.user_id = ${userId}`);

      return { profile: profile ?? {}, preferences, workspace: workspace ?? {}, content };
    },
  };
}
