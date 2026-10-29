import { getCurrentActor } from '@/modules/identity';
import { getViews, postView } from '@/modules/views';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §11: kayıtlı görünümler (BR-VIEW-001, D-051). */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getViews });
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postView });
