import { postExport } from '@/modules/data-portability';
import { getCurrentActor } from '@/modules/identity';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §14: JSON dışa aktarma (D-046, D-055, D-059). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postExport });
