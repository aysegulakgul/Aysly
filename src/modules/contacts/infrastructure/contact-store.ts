import { and, asc, count, eq } from 'drizzle-orm';
import type { WorkspaceScope } from '@/modules/workspaces';
import { anyUuid } from '@/shared/db/any-uuid';
import type { DbExecutor } from '@/shared/db/client';
import { isUuid } from '@/shared/kernel/id';
import type { ContactStore } from '../application/contacts';
import type { Contact, ContactColor } from '../domain/contact';
import { contacts } from './schema';

const toContact = (row: typeof contacts.$inferSelect): Contact => ({
  ...row,
  color: row.color as ContactColor,
});
const inScope = (scope: WorkspaceScope) => eq(contacts.workspaceId, scope.workspaceId);

export function createContactStore(db: DbExecutor): ContactStore {
  return {
    async list(scope) {
      const rows = await db
        .select()
        .from(contacts)
        .where(inScope(scope))
        .orderBy(asc(contacts.name));
      return rows.map(toContact);
    },
    async count(scope) {
      const [row] = await db.select({ n: count() }).from(contacts).where(inScope(scope));
      return row?.n ?? 0;
    },
    async insert(scope, c) {
      const [row] = await db
        .insert(contacts)
        .values({
          id: c.id,
          workspaceId: scope.workspaceId,
          name: c.name,
          email: c.email,
          color: c.color,
          createdAt: c.now,
          updatedAt: c.now,
        })
        .returning();
      return toContact(row!);
    },
    async update(scope, id, changes, now) {
      const [row] = await db
        .update(contacts)
        .set({ ...changes, updatedAt: now })
        .where(and(inScope(scope), eq(contacts.id, id)))
        .returning();
      return row ? toContact(row) : null;
    },
    async remove(scope, id) {
      const rows = await db
        .delete(contacts)
        .where(and(inScope(scope), eq(contacts.id, id)))
        .returning({ id: contacts.id });
      return rows.length > 0;
    },
  };
}

/** Görev atamaları için kişi özetleri (D-097); başka çalışma alanının kişisi hiç dönmez. */
export async function findContactRefs(
  db: DbExecutor,
  scope: WorkspaceScope,
  ids: readonly string[],
): Promise<Map<string, { id: string; name: string; color: string }>> {
  const valid = ids.filter(isUuid);
  if (valid.length === 0) return new Map();
  const rows = await db
    .select({ id: contacts.id, name: contacts.name, color: contacts.color })
    .from(contacts)
    .where(and(inScope(scope), anyUuid(contacts.id, valid)));
  return new Map(rows.map((r) => [r.id, r]));
}
