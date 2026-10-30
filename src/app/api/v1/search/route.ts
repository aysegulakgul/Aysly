import { getCurrentActor } from '@/modules/identity';
import { getSearch } from '@/modules/search';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §11: global arama (BR-SRCH-001/002). */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getSearch });
