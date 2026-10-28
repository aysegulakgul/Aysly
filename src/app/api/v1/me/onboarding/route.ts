import { getCurrentActor } from '@/modules/identity';
import { postOnboarding } from '@/modules/preferences';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §4: POST /me/onboarding — onboarding yanıtı (ONBOARDING §2). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postOnboarding });
