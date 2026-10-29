import { db } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { systemClock } from '@/shared/kernel/clock';
import {
  listNotifications,
  markAllRead,
  markNotification,
  type Notification,
} from '../application/notifications';
import { createNotificationStore } from '../infrastructure/notification-store';

/** API bildirim nesnesi (API_CONTRACTS §12). */
export function toNotificationJson(n: Notification) {
  return {
    id: n.id,
    type: n.type,
    workspaceId: n.workspaceId,
    entityType: n.entityType,
    entityId: n.entityId,
    payload: n.payload,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}
export type NotificationView = ReturnType<typeof toNotificationJson>;

/** GET /notifications?unreadOnly=&before= — en yeni 20; `before` önceki sayfanın son `createdAt` değeri. */
export async function getNotifications(ctx: ApiContext): Promise<Response> {
  const query = new URL(ctx.request.url).searchParams;
  const beforeRaw = query.get('before');
  const before = beforeRaw ? new Date(beforeRaw) : undefined;
  if (before && Number.isNaN(before.getTime())) {
    return ctx.fail({ kind: 'validation', issues: [{ field: 'before', reason: 'invalid' }] });
  }
  const result = await listNotifications(createNotificationStore(db()), ctx.actor.userId, {
    unreadOnly: query.get('unreadOnly') === 'true',
    before,
  });
  return result.ok
    ? ctx.json(200, { data: result.value.map(toNotificationJson) })
    : ctx.fail(result.error);
}

export async function getUnreadCount(ctx: ApiContext): Promise<Response> {
  const count = await createNotificationStore(db()).unreadCount(ctx.actor.userId);
  return ctx.json(200, { data: { count } });
}

const mark = (read: boolean) => async (ctx: ApiContext) => {
  const result = await markNotification(
    createNotificationStore(db()),
    ctx.actor.userId,
    ctx.params.id ?? '',
    read,
    systemClock.now(),
  );
  return result.ok ? new Response(null, { status: 204 }) : ctx.fail(result.error);
};
export const postNotificationRead = mark(true);
export const postNotificationUnread = mark(false);

export async function postReadAll(ctx: ApiContext): Promise<Response> {
  const result = await markAllRead(
    createNotificationStore(db()),
    ctx.actor.userId,
    systemClock.now(),
  );
  return result.ok ? ctx.json(200, { data: result.value }) : ctx.fail(result.error);
}

/** Sunucu bileşenleri için (bildirim sayfası). */
export async function findNotifications(userId: string) {
  const result = await listNotifications(createNotificationStore(db()), userId, {
    unreadOnly: false,
  });
  return result.ok ? result.value.map(toNotificationJson) : [];
}
