import { getCurrentActor } from '@/modules/identity';
import { postOnboardingSkip } from '@/modules/preferences';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §4: POST /me/onboarding/skip — onboarding'i atla (ONBOARDING §2). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postOnboardingSkip });
