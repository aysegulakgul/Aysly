import { getCurrentActor } from '@/modules/identity';
import { getGoals, postGoal } from '@/modules/goals';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §10: hedefler (BR-GOAL-001..004). */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getGoals });
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postGoal });
