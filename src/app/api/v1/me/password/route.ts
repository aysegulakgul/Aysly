import { getCurrentActor, postPassword } from '@/modules/identity';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §3: POST /me/password — şifre değiştirme (BR-ACC-002, BR-ACC-006). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postPassword });
