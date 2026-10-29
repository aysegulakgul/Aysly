import { getCurrentActor } from '@/modules/identity';
import { postReadAll } from '@/modules/notifications';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §12: tümünü okundu say (BR-NOTIF-003). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postReadAll });
