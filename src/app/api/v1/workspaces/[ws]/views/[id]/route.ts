import { getCurrentActor } from '@/modules/identity';
import { deleteOneView, getOneView, patchView } from '@/modules/views';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §11: kayıtlı görünüm (BR-VIEW-001). */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getOneView });
export const PATCH = apiRoute({ resolveActor: getCurrentActor, handler: patchView });
export const DELETE = apiRoute({ resolveActor: getCurrentActor, handler: deleteOneView });
