import { getCurrentActor } from '@/modules/identity';
import { postNotificationUnread } from '@/modules/notifications';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §12: okunmadı yap (BR-NOTIF-003). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postNotificationUnread });
