import { getCurrentActor } from '@/modules/identity';
import { getOneTask, patchTask } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §6.1: görev detayı ve güncelleme (BR-TASK-010). */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getOneTask });
export const PATCH = apiRoute({ resolveActor: getCurrentActor, handler: patchTask });
