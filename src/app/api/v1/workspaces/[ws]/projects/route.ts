import { getCurrentActor } from '@/modules/identity';
import { getProjects } from '@/modules/projects';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §5: etkin projeler (salt okunur ilk sürüm). */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getProjects });
