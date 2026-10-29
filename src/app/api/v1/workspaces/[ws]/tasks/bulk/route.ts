import { getCurrentActor } from '@/modules/identity';
import { postBulk } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §6.6: toplu işlem (BR-TASK-008, D-084). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postBulk });
