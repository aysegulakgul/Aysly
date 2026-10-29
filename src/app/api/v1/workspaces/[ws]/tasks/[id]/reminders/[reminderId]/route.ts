import { getCurrentActor } from '@/modules/identity';
import { deleteOneReminder } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §8: hatırlatıcı silme. */
export const DELETE = apiRoute({ resolveActor: getCurrentActor, handler: deleteOneReminder });
