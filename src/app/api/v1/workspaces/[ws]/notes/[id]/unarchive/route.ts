import { getCurrentActor } from '@/modules/identity';
import { postNoteUnarchive } from '@/modules/notes';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §9: arşivden çıkarma. */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postNoteUnarchive });
