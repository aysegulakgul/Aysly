import { forbidden, type DomainError } from '@/shared/kernel/errors';
import { err, ok, type Result } from '@/shared/kernel/result';
import { ROLE_PERMISSIONS, type Permission } from '../domain/permissions';
import type { WorkspaceScope } from '../domain/scope';

/** BR-PERM-001 / D-003: her use case işlemden önce izni sunucuda denetler. */
export function authorize(
  scope: WorkspaceScope,
  permission: Permission,
): Result<void, DomainError> {
  return ROLE_PERMISSIONS[scope.role].has(permission) ? ok(undefined) : err(forbidden());
}
