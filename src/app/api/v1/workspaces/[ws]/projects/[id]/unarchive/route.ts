import { getCurrentActor } from '@/modules/identity';
import { postProjectUnarchive } from '@/modules/projects';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §5: arşivden çıkarma (BR-PROJ-004). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postProjectUnarchive });
