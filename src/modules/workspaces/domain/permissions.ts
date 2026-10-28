/** İzin listesi ve rol eşlemesi (ROLES_AND_PERMISSIONS §5–6). MVP'de yalnızca kişisel alan ve `owner` rolü vardır. */
export const PERMISSIONS = [
  'workspace.read',
  'project.read',
  'project.create',
  'project.update',
  'project.archive',
  'project.delete',
  'project.restore',
  'project.purge',
  'task.read',
  'task.create',
  'task.update',
  'task.complete',
  'task.archive',
  'task.delete',
  'task.restore',
  'task.purge',
  'tag.manage',
  'trash.empty',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type Role = 'owner';

/** §6.1: kişisel alanın sahibi tüm içerik izinlerine sahiptir. Diğer roller Faz 10'da eklenir. */
export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set(PERMISSIONS),
};
