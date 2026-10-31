/** identity modülünün dışa açık yüzü (ARCHITECTURE §4.2). */
export { auth } from './infrastructure/auth';
export { getCurrentActor, getCurrentUser, getSessionStartedAt } from './infrastructure/session';
export { handleSignUp } from './http/sign-up-handler';
export {
  accountDeletionJob,
  deleteDeletion,
  deleteSession,
  deleteSessions,
  findActiveSessions,
  getSessions,
  patchMe,
  postEmail,
  postDeletion,
  postPassword,
  rateLimited,
  verifyCurrentPassword,
} from './http/account-handlers';
export type { SessionSummary } from './application/account';
export { DELETION_GRACE_DAYS, deletionDueAt } from './application/account-deletion';
export type { CurrentUser } from './application/current-user';
