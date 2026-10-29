import { getCurrentActor } from '@/modules/identity';
import { deleteOneTag, patchTag } from '@/modules/tags';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §7: etiket yönetimi (BR-TAG-001/002, D-085). */
export const PATCH = apiRoute({ resolveActor: getCurrentActor, handler: patchTag });
export const DELETE = apiRoute({ resolveActor: getCurrentActor, handler: deleteOneTag });
