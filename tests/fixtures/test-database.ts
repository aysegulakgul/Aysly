import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { runMigrations } from '@/shared/db/migrate';

/**
 * Her test dosyası için geçici, boş bir PostgreSQL (Docker) açar ve migration'ları uygular (TESTING_STRATEGY §8, D-056).
 * Gerçek kullanıcı verisi içeren yerel veritabanına asla dokunulmaz.
 */
export async function startTestDatabase(): Promise<{ url: string; stop: () => Promise<void> }> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:17-alpine')
    .withEnvironment({ TZ: 'UTC', PGTZ: 'UTC' })
    .start();
  const url = container.getConnectionUri();
  await runMigrations(url);
  return { url, stop: async () => void (await container.stop()) };
}
