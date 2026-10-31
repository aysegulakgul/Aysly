import { getContacts, postContact } from '@/modules/contacts';
import { getCurrentActor } from '@/modules/identity';
import { apiRoute } from '@/shared/http/api-route';

/** D-097: kişiler. */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getContacts });
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postContact });
