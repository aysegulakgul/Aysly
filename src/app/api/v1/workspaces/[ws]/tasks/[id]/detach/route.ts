import { getCurrentActor } from '@/modules/identity';
import { postDetach } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §6.1: alt görevi bağımsız göreve dönüştürme (BR-SUB-002). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postDetach });
