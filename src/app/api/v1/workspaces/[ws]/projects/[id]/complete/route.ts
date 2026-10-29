import { getCurrentActor } from '@/modules/identity';
import { postProjectComplete } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §5: projeyi tamamla (BR-PROJ-002). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postProjectComplete });
