import { getCurrentActor } from '@/modules/identity';
import { patchProject } from '@/modules/projects';
import { deleteOneProject, getOneProject } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §5: proje detayı, düzenleme, çöpe taşıma (BR-PROJ-005). */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getOneProject });
export const PATCH = apiRoute({ resolveActor: getCurrentActor, handler: patchProject });
export const DELETE = apiRoute({ resolveActor: getCurrentActor, handler: deleteOneProject });
