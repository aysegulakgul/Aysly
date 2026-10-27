import type { DbExecutor } from '@/shared/db/client';
import { auditEvents } from './schema';

export type AuditEvent = {
  id: string;
  action: string;
  actorUserId: string | null;
  workspaceId?: string | null;
  entityType?: string;
  entityId?: string;
  /** Yalnızca kimlikler ve sayılar; içerik veya e-posta yazılmaz (SECURITY §7). */
  metadata?: Record<string, string | number | boolean>;
  now: Date;
};

export async function recordAuditEvent(db: DbExecutor, event: AuditEvent): Promise<void> {
  await db.insert(auditEvents).values({
    id: event.id,
    action: event.action,
    actorUserId: event.actorUserId,
    workspaceId: event.workspaceId ?? null,
    entityType: event.entityType ?? null,
    entityId: event.entityId ?? null,
    metadata: event.metadata ?? {},
    createdAt: event.now,
  });
}
