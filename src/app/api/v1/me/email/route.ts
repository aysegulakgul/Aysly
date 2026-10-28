import { getCurrentActor, postEmail } from '@/modules/identity';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §3: POST /me/email — e-posta değiştirme talebi (BR-ACC-004). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postEmail });
