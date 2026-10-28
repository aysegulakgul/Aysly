import { and, desc, eq, gt, ne } from 'drizzle-orm';
import type { DbExecutor } from '@/shared/db/client';
import type { AccountStore } from '../application/account';
import { authSessions, users } from './schema';

export function createDrizzleAccountStore(db: DbExecutor): AccountStore {
  return {
    async findUser(userId) {
      const [row] = await db
        .select({ email: users.email, emailVerified: users.emailVerified })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      return row ?? null;
    },

    async updateName(userId, name, now) {
      await db.update(users).set({ name, updatedAt: now }).where(eq(users.id, userId));
    },

    // Token alanı hiçbir zaman seçilmez; istemciye yalnızca oturum kimliği ve özet bilgi döner.
    listActiveSessions(userId, now) {
      return db
        .select({
          id: authSessions.id,
          createdAt: authSessions.createdAt,
          lastSeenAt: authSessions.updatedAt,
          userAgent: authSessions.userAgent,
        })
        .from(authSessions)
        .where(and(eq(authSessions.userId, userId), gt(authSessions.expiresAt, now)))
        .orderBy(desc(authSessions.updatedAt));
    },

    async deleteSession(userId, sessionId) {
      const deleted = await db
        .delete(authSessions)
        .where(and(eq(authSessions.id, sessionId), eq(authSessions.userId, userId)))
        .returning({ id: authSessions.id });
      return deleted.length > 0;
    },

    async deleteOtherSessions(userId, keepSessionId) {
      const deleted = await db
        .delete(authSessions)
        .where(and(eq(authSessions.userId, userId), ne(authSessions.id, keepSessionId)))
        .returning({ id: authSessions.id });
      return deleted.length;
    },
  };
}
