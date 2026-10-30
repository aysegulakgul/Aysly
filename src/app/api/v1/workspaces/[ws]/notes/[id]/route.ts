import { getCurrentActor } from '@/modules/identity';
import { deleteOneNote, getOneNote, patchNote } from '@/modules/notes';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §9: not detayı, otomatik kayıt, çöpe taşıma. */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getOneNote });
export const PATCH = apiRoute({ resolveActor: getCurrentActor, handler: patchNote });
export const DELETE = apiRoute({ resolveActor: getCurrentActor, handler: deleteOneNote });
