import { deleteSessions, getCurrentActor, getSessions } from '@/modules/identity';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §3: aktif oturumlar ve diğer oturumları kapatma (BR-ACC-006). */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getSessions });
export const DELETE = apiRoute({ resolveActor: getCurrentActor, handler: deleteSessions });
