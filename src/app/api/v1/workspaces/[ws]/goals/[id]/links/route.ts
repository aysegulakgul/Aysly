import { getCurrentActor } from '@/modules/identity';
import { putGoalLinks } from '@/modules/goals';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §10: hedef bağlantıları (FR-GOAL-02). */
export const PUT = apiRoute({ resolveActor: getCurrentActor, handler: putGoalLinks });
