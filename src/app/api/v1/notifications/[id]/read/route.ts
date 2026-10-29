import { getCurrentActor } from '@/modules/identity';
import { postNotificationRead } from '@/modules/notifications';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §12: okundu yap (BR-NOTIF-003). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postNotificationRead });
