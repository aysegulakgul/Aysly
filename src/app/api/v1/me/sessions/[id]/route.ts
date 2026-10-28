import { deleteSession, getCurrentActor } from '@/modules/identity';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §3: tek oturumu kapatma (BR-ACC-006). */
export const DELETE = apiRoute({ resolveActor: getCurrentActor, handler: deleteSession });
