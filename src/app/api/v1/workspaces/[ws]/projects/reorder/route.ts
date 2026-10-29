import { getCurrentActor } from '@/modules/identity';
import { postProjectReorder } from '@/modules/projects';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §5: manuel proje sırası (FR-PROJ-04). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postProjectReorder });
