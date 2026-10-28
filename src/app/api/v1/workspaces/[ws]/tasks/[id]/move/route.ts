import { getCurrentActor } from '@/modules/identity';
import { postMove } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §6.1: görevi başka projeye taşıma (BR-INBOX-002, BR-SUB-002). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postMove });
