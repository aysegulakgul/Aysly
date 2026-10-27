import { sql } from 'drizzle-orm';
import type { Database } from './client';

export async function isDatabaseReachable(database: Database): Promise<boolean> {
  try {
    await database.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
