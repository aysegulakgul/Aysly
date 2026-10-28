import { authorize, resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { db } from '@/shared/db/client';
import type { ApiContext } from '@/shared/http/api-route';
import { listActiveProjects } from '../infrastructure/project-reader';

/**
 * GET /workspaces/{ws}/projects (API_CONTRACTS §5, Faz 4'te salt okunur ilk sürüm): etkin projeler, Inbox ilk.
 * Proje oluşturma/düzenleme ve ilerleme alanı Faz 5'te.
 */
export async function getProjects(ctx: ApiContext): Promise<Response> {
  const scope = await resolveWorkspaceScope(db(), ctx.actor.userId, ctx.params.ws ?? '');
  if (!scope) return ctx.fail({ kind: 'not_found' });
  const allowed = authorize(scope, 'project.read');
  if (!allowed.ok) return ctx.fail(allowed.error);
  const projects = await listActiveProjects(db(), scope);
  return ctx.json(200, {
    data: projects.map(({ id, name, kind }) => ({ id, name, kind })),
  });
}

/** Sunucu bileşenleri için etkin projeler (taşıma ve seçim listeleri). */
export async function findActiveProjects(scope: WorkspaceScope) {
  const allowed = authorize(scope, 'project.read');
  if (!allowed.ok) return [];
  return (await listActiveProjects(db(), scope)).map(({ id, name, kind }) => ({ id, name, kind }));
}
