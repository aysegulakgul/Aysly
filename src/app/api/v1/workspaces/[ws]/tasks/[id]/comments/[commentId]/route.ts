import { getCurrentActor } from '@/modules/identity';
import { deleteOneComment } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** D-099: kendi yorumunu silme (BR-COMMENT-001). */
export const DELETE = apiRoute({ resolveActor: getCurrentActor, handler: deleteOneComment });
