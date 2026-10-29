import { getCurrentActor } from '@/modules/identity';
import { getProjectDeletePreview } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §5: silme onayı için etkilenecek görev sayısı. */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getProjectDeletePreview });
