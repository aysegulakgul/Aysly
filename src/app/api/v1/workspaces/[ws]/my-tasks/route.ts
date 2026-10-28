import { getCurrentActor } from '@/modules/identity';
import { getMyTasks } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §6.1: Görevlerim, son tarihe göre gruplu (BR-INBOX-004). */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getMyTasks });
