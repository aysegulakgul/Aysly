import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/shared/config/env';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

let sqlClient: postgres.Sql | undefined;
let database: Database | undefined;

/** Veritabanı oturumu her zaman UTC'dir (DATA_MODEL §6). */
export function createSqlClient(url: string, max = 10): postgres.Sql {
  return postgres(url, { max, connection: { TimeZone: 'UTC' }, onnotice: () => {} });
}

export function db(): Database {
  if (!database) {
    sqlClient = createSqlClient(env().DATABASE_URL);
    database = drizzle(sqlClient, { schema });
  }
  return database;
}

/** Ham postgres.js istemcisi; yalnızca altyapı kodu (ör. advisory lock) için. */
export function sqlClientInstance(): postgres.Sql {
  db();
  return sqlClient as postgres.Sql;
}

export async function closeDb(): Promise<void> {
  await sqlClient?.end({ timeout: 5 });
  sqlClient = undefined;
  database = undefined;
}

/** Bir veritabanı işlemi (transaction) veya doğrudan bağlantı; modüller arası tek işlemde yazmak için (ARCHITECTURE §4.2). */
export type DbTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DbExecutor = Database | DbTransaction;
