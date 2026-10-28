import { getCurrentActor } from '@/modules/identity';
import { postComplete } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §6.1: tamamlama (BR-TASK-004). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postComplete });
