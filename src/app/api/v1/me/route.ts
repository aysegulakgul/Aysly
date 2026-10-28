import { getCurrentActor, patchMe } from '@/modules/identity';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §3: PATCH /me — profil (ad). */
export const PATCH = apiRoute({ resolveActor: getCurrentActor, handler: patchMe });
