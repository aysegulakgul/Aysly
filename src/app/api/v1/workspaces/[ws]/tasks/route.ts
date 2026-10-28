import { getCurrentActor } from '@/modules/identity';
import { getTasks, postTask } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §6.1: görev listesi ve oluşturma (BR-TASK-001/002/007). */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getTasks });
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postTask });
