import { getCurrentActor } from '@/modules/identity';
import { postRestore } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §13: geri yükleme (BR-DEL-004, BR-SUB-004). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postRestore });
