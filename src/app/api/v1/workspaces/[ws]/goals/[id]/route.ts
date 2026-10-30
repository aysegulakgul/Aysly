import { getCurrentActor } from '@/modules/identity';
import { deleteOneGoal, getOneGoal, patchGoal } from '@/modules/goals';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §10: hedef detayı, düzenleme, çöpe taşıma. */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getOneGoal });
export const PATCH = apiRoute({ resolveActor: getCurrentActor, handler: patchGoal });
export const DELETE = apiRoute({ resolveActor: getCurrentActor, handler: deleteOneGoal });
