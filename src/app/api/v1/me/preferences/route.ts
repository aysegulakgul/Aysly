import { getCurrentActor } from '@/modules/identity';
import { getPreferences, patchPreferences } from '@/modules/preferences';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §4: kullanıcı tercihleri (BR-PREF-001..003). */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getPreferences });
export const PATCH = apiRoute({ resolveActor: getCurrentActor, handler: patchPreferences });
