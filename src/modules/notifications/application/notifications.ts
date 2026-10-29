import type { DomainError } from '@/shared/kernel/errors';
import { notFound } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';

/** BR-NOTIF-001: MVP'de tek tür `reminder`, tek kanal uygulama içi (D-037). */
export type ReminderPayload = {
  taskId: string;
  title: string;
  remindAt: string;
  /** BR-REM-005: 15 dakikadan fazla geciken hatırlatıcı "gecikmeli" gösterilir. */
  late: boolean;
};

export type Notification = {
  id: string;
  type: 'reminder';
  workspaceId: string | null;
  entityType: string | null;
  entityId: string | null;
  payload: ReminderPayload;
  readAt: Date | null;
  createdAt: Date;
};

export type NotificationStore = {
  /** Yeni kayıt oluştuysa true; aynı `dedupe_key` varsa false (BR-NOTIF-002). */
  create(n: {
    id: string;
    userId: string;
    workspaceId: string | null;
    type: 'reminder';
    entityType: string | null;
    entityId: string | null;
    payload: ReminderPayload;
    dedupeKey: string;
    now: Date;
  }): Promise<boolean>;
  list(
    userId: string,
    options: { unreadOnly: boolean; before?: Date | undefined; limit: number },
  ): Promise<Notification[]>;
  unreadCount(userId: string): Promise<number>;
  /** `ids` boşsa tüm okunmamışlar ("tümünü okundu say"). */
  setRead(userId: string, ids: readonly string[], readAt: Date | null): Promise<number>;
};

export const NOTIFICATION_PAGE = 20;

/**
 * Bildirimler kullanıcıya aittir (API_CONTRACTS §12): her işlem aktörün kimliğiyle süzülür; başka kullanıcının
 * bildirimi bulunamadı sayılır.
 */
export async function listNotifications(
  store: NotificationStore,
  userId: string,
  options: { unreadOnly: boolean; before?: Date | undefined },
): Promise<Result<Notification[], DomainError>> {
  return ok(await store.list(userId, { ...options, limit: NOTIFICATION_PAGE }));
}

export async function markNotification(
  store: NotificationStore,
  userId: string,
  id: string,
  read: boolean,
  now: Date,
): Promise<Result<null, DomainError>> {
  const changed = await store.setRead(userId, [id], read ? now : null);
  return changed > 0 ? ok(null) : err(notFound());
}

export async function markAllRead(
  store: NotificationStore,
  userId: string,
  now: Date,
): Promise<Result<{ updated: number }, DomainError>> {
  return ok({ updated: await store.setRead(userId, [], now) });
}
