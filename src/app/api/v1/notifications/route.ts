import { getCurrentActor } from '@/modules/identity';
import { getNotifications } from '@/modules/notifications';
import { dispatchRemindersFor } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §12: aktörün bildirimleri; önce zamanı gelmiş hatırlatıcılar işlenir (BR-REM-005, D-053). */
export const GET = apiRoute({
  resolveActor: getCurrentActor,
  handler: async (ctx) => {
    await dispatchRemindersFor(ctx.actor.userId);
    return getNotifications(ctx);
  },
});
