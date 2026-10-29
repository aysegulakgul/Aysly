import { getCurrentActor } from '@/modules/identity';
import { postReminder } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §8: hatırlatıcı ekleme (BR-REM-001/002). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postReminder });
