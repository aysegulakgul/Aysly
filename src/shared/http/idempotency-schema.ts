import { integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '@/modules/identity/infrastructure/schema';

/**
 * Oluşturma isteklerinin idempotency kayıtları (D-019, BR-TASK-007, DATA_MODEL §4). 24 saat sonra silinir.
 * `response_status = 0` işlemin sürdüğünü gösterir; aynı anahtarlı ikinci istek ilk işlemin bitmesini bekler.
 */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    requestHash: text('request_hash').notNull(),
    responseStatus: integer('response_status').notNull(),
    responseBody: jsonb('response_body'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);
