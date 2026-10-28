import { getCurrentActor } from '@/modules/identity';
import { postArchive } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §6.1: arşivleme (BR-DEL-002, BR-SUB-004). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postArchive });
