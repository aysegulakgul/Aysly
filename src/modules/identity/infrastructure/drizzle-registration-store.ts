import { recordAuditEvent } from '@/modules/audit';
import { insertDefaultPreferences } from '@/modules/preferences';
import { insertInbox } from '@/modules/projects';
import { insertPersonalWorkspace } from '@/modules/workspaces';
import type { Database } from '@/shared/db/client';
import type { NewPersonalAccount, RegistrationStore } from '../application/register-user';
import { authAccounts, users } from './schema';

const UNIQUE_VIOLATION = '23505';

function isEmailUniqueViolation(error: unknown): boolean {
  const candidates = [error, (error as { cause?: unknown })?.cause];
  return candidates.some((c) => {
    const pg = c as { code?: string; constraint_name?: string } | undefined;
    return pg?.code === UNIQUE_VIOLATION && pg.constraint_name === 'users_email_unique';
  });
}

/**
 * BR-WS-001: Kayıt verisi tek veritabanı işleminde yazılır; herhangi bir adım başarısız olursa hiçbiri kalmaz.
 * Diğer modüllerin kayıtları, o modüllerin index.ts üzerinden açtığı fonksiyonlarla aynı işlemde yazılır.
 * E-posta benzersizliği veritabanı kısıtıyla da korunur (eşzamanlı iki kayıt denemesi dahil).
 */
export function createDrizzleRegistrationStore(database: Database): RegistrationStore {
  return {
    async createPersonalAccount(a: NewPersonalAccount) {
      try {
        await database.transaction(async (tx) => {
          await tx.insert(users).values({
            id: a.userId,
            name: a.name,
            email: a.email,
            emailVerified: false,
            createdAt: a.now,
            updatedAt: a.now,
          });
          await tx.insert(authAccounts).values({
            id: a.accountId,
            userId: a.userId,
            accountId: a.userId,
            providerId: 'credential',
            password: a.passwordHash,
            createdAt: a.now,
            updatedAt: a.now,
          });
          await insertPersonalWorkspace(tx, {
            workspaceId: a.workspaceId,
            membershipId: a.membershipId,
            ownerUserId: a.userId,
            name: a.workspaceName,
            now: a.now,
          });
          await insertInbox(tx, {
            projectId: a.inboxProjectId,
            workspaceId: a.workspaceId,
            createdBy: a.userId,
            now: a.now,
          });
          await insertDefaultPreferences(tx, {
            userId: a.userId,
            preferences: a.preferences,
            now: a.now,
          });
          await recordAuditEvent(tx, {
            id: a.auditEventId,
            action: 'auth.sign_up',
            actorUserId: a.userId,
            workspaceId: a.workspaceId,
            entityType: 'user',
            entityId: a.userId,
            now: a.now,
          });
        });
        return 'created';
      } catch (error) {
        if (isEmailUniqueViolation(error)) return 'email_taken';
        throw error;
      }
    },
  };
}
