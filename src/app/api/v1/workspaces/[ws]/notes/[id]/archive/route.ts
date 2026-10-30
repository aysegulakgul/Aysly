import { getCurrentActor } from '@/modules/identity';
import { postNoteArchive } from '@/modules/notes';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §9: not arşivleme (BR-DEL-002). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postNoteArchive });
