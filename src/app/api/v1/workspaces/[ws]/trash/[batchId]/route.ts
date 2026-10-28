import { getCurrentActor } from '@/modules/identity';
import { deleteTrash } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §13: silme grubunu kalıcı silme (BR-DEL-005). */
export const DELETE = apiRoute({ resolveActor: getCurrentActor, handler: deleteTrash });
