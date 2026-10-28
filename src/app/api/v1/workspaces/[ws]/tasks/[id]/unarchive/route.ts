import { getCurrentActor } from '@/modules/identity';
import { postUnarchive } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §6.1: arşivden çıkarma (BR-DEL-002). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postUnarchive });
