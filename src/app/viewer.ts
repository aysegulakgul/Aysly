import { cache } from 'react';
import { getCurrentUser, type CurrentUser } from '@/modules/identity';
import { findUserPreferences, type Preferences } from '@/modules/preferences';
import {
  findPersonalWorkspaceId,
  resolveWorkspaceScope,
  type WorkspaceScope,
} from '@/modules/workspaces';
import { db } from '@/shared/db/client';

export type Viewer = { user: CurrentUser; preferences: Preferences };

/** Oturumdaki kullanıcı ve tercihleri; sayfa düzeni ve sayfalar aynı istekte tek sorguyu paylaşır. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const preferences = await findUserPreferences(db(), user.id);
  return preferences ? { user, preferences } : null;
});

/** Kullanıcının kişisel çalışma alanı kapsamı (MVP'de tek alan, BR-WS-001); üyelik doğrulanarak üretilir. */
export const getPersonalScope = cache(async (): Promise<WorkspaceScope | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspaceId = await findPersonalWorkspaceId(db(), user.id);
  return workspaceId ? resolveWorkspaceScope(db(), user.id, workspaceId) : null;
});
