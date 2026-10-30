import { getCurrentActor } from '@/modules/identity';
import { getArchive } from '@/modules/lifecycle';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §13: arşiv sayfası (FR-SET-06). */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getArchive });
