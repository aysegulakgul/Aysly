import { getCurrentActor } from '@/modules/identity';
import { getUnreadCount } from '@/modules/notifications';
import { dispatchRemindersFor } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §12: okunmamış sayısı; istemci uygulama açıkken ~60 sn'de bir yoklar (D-053). */
export const GET = apiRoute({
  resolveActor: getCurrentActor,
  handler: async (ctx) => {
    await dispatchRemindersFor(ctx.actor.userId);
    return getUnreadCount(ctx);
  },
});
