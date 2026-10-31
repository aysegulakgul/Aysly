import { getCurrentActor } from '@/modules/identity';
import { getComments, postComment } from '@/modules/tasks';
import { apiRoute } from '@/shared/http/api-route';

/** D-099: görev yorumları. */
export const GET = apiRoute({ resolveActor: getCurrentActor, handler: getComments });
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postComment });
