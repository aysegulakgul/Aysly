/** identity modülünün dışa açık yüzü (ARCHITECTURE §4.2). */
export { auth } from './infrastructure/auth';
export { getCurrentActor, getCurrentUser } from './infrastructure/session';
export { handleSignUp } from './http/sign-up-handler';
export {
  deleteSession,
  deleteSessions,
  findActiveSessions,
  getSessions,
  patchMe,
  postEmail,
  postPassword,
} from './http/account-handlers';
export type { SessionSummary } from './application/account';
export type { CurrentUser } from './application/current-user';
