import { getCurrentActor } from '@/modules/identity';
import { patchChecklist } from '@/modules/preferences';
import { apiRoute } from '@/shared/http/api-route';

/** ONBOARDING §4: İlk adımlar listesini kapatma / kısayol rehberi görüldü. */
export const PATCH = apiRoute({ resolveActor: getCurrentActor, handler: patchChecklist });
