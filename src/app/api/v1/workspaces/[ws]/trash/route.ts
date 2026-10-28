import { getCurrentActor } from '@/modules/identity';
import { deleteTrash, getTrash } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §13: çöp kutusu ve çöpü boşaltma (BR-DEL-003/005). */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getTrash });
export const DELETE = apiRoute({ resolveActor: getCurrentActor, handler: deleteTrash });
