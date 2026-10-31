import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from '@/modules/workspaces/infrastructure/schema';

/**
 * Kişiler (D-097): görevlere atanabilen ekip arkadaşları. Hesap değildir, giriş yapamaz; çalışma alanına aittir.
 */
export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email'),
    color: text('color').notNull().default('blue'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('contacts_workspace_id_unique').on(t.workspaceId, t.id),
    // BR-CONTACT-001
    check('contacts_name_length', sql`char_length(btrim(${t.name})) between 1 and 100`),
    check('contacts_email_length', sql`${t.email} is null or char_length(${t.email}) <= 254`),
    index('contacts_workspace_idx').on(t.workspaceId, t.name),
  ],
);
