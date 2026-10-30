import { getCurrentActor } from '@/modules/identity';
import { postGoalUnarchive } from '@/modules/goals';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §10: arşivden çıkarma. */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postGoalUnarchive });
