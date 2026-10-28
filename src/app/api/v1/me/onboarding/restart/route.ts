import { getCurrentActor } from '@/modules/identity';
import { postOnboardingRestart } from '@/modules/preferences';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §4: POST /me/onboarding/restart — onboarding'i Ayarlar'dan yeniden başlat (ONBOARDING §2). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postOnboardingRestart });
