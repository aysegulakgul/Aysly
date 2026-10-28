import type { Role } from './permissions';

declare const scopeBrand: unique symbol;

/**
 * Çalışma alanı kapsamı (ARCHITECTURE §6, ROLES_AND_PERMISSIONS §7 `ActorInWorkspace`). Yalnızca üyelik
 * doğrulandıktan sonra `resolveWorkspaceScope` tarafından üretilir; çalışma alanı verisine erişen her depo
 * metodu bunu ister. Böylece kapsamsız sorgu yazmak derleme zamanında zorlaşır.
 */
export type WorkspaceScope = {
  readonly userId: string;
  readonly workspaceId: string;
  readonly role: Role;
  readonly [scopeBrand]: true;
};

/** Yalnızca üyelik çözümleyicisi ve testler kullanır; modülün index.ts dosyasından dışarı açılmaz. */
export const createScope = (userId: string, workspaceId: string, role: Role) =>
  ({ userId, workspaceId, role }) as WorkspaceScope;
