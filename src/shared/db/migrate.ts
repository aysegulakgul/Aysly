import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createSqlClient } from './client';

/** Her migration kendi işleminde çalışır; hata olursa o migration geri alınır (ERROR_HANDLING E25). */
export async function runMigrations(url: string, migrationsFolder = './drizzle'): Promise<void> {
  const client = createSqlClient(url, 1);
  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end({ timeout: 5 });
  }
}
