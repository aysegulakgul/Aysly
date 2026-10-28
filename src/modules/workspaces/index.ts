/** workspaces modülünün dışa açık yüzü (ARCHITECTURE §4.2). */
export {
  findPersonalWorkspaceId,
  insertPersonalWorkspace,
} from './infrastructure/personal-workspace-writer';
export { resolveWorkspaceScope } from './infrastructure/membership';
export { getWorkspaces } from './http/workspace-handlers';
export { authorize } from './application/authorize';
export type { Permission, Role } from './domain/permissions';
export type { WorkspaceScope } from './domain/scope';
