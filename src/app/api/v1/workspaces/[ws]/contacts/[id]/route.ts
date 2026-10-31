import { deleteOneContact, patchContact } from '@/modules/contacts';
import { getCurrentActor } from '@/modules/identity';
import { apiRoute } from '@/shared/http/api-route';

/** D-097: kişi güncelleme ve silme. */
export const PATCH = apiRoute({ resolveActor: getCurrentActor, handler: patchContact });
export const DELETE = apiRoute({ resolveActor: getCurrentActor, handler: deleteOneContact });
