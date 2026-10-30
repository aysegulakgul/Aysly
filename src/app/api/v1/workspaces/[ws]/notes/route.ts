import { getCurrentActor } from '@/modules/identity';
import { getNotes, postNote } from '@/modules/notes';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §9: notlar (BR-NOTE-001..004). */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getNotes });
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postNote });
