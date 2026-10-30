import { getCurrentActor } from '@/modules/identity';
import { postGoalArchive } from '@/modules/goals';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §10: hedef arşivleme. */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postGoalArchive });
