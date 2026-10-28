import { getCurrentActor } from '@/modules/identity';
import { postReopen } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §6.1: yeniden açma (BR-TASK-004). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postReopen });
