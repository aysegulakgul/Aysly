import { getCurrentActor } from '@/modules/identity';
import { getTags } from '@/modules/tags';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §7: etiketler. */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getTags });
