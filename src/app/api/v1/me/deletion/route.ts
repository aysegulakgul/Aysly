import { deleteDeletion, getCurrentActor, postDeletion } from '@/modules/identity';
import { apiRoute } from '@/shared/http/api-route';

/** API_CONTRACTS §3: hesap silme talebi ve iptali (BR-ACC-005, D-036, D-092). */
export const POST = apiRoute({ resolveActor: getCurrentActor, handler: postDeletion });
export const DELETE = apiRoute({
  resolveActor: getCurrentActor,
  allowDeletionPending: true,
  handler: deleteDeletion,
});
