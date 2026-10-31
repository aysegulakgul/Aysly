import { sql, type AnyColumn, type SQL } from 'drizzle-orm';

/**
 * `column IN (...)` yerine tek parametreli `column = any(uuid[])` (NFR-01/03). Binlerce kimlikte her kimlik ayrı bağ
 * parametresi olmaz; kimlikler tek metin parametresi olarak gider ve veritabanında diziye çevrilir.
 */
export function anyUuid(column: AnyColumn, ids: readonly string[]): SQL {
  return sql`${column} = any(string_to_array(${ids.join(',')}, ',')::uuid[])`;
}
