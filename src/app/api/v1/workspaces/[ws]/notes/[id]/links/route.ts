import { getCurrentActor } from '@/modules/identity';
import { putNoteLinks } from '@/modules/notes';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §9: not bağlantıları (BR-NOTE-003). */
export const PUT = apiRoute({ resolveActor: getCurrentActor, handler: putNoteLinks });
