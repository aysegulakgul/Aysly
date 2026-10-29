import { describe, expect, it } from 'vitest';
import type { WorkspaceScope } from '@/modules/workspaces';
import { fixedClock } from '@/shared/kernel/clock';
import type { Project } from '../domain/project';
import { normalizeProjectName, progressPercent } from '../domain/project';
import {
  archiveProject,
  createProject,
  reorderProject,
  unarchiveProject,
  updateProject,
  type ProjectRepository,
} from './projects';

const scope = { userId: 'u1', workspaceId: 'w1', role: 'owner' } as WorkspaceScope;
const now = new Date('2026-10-29T09:00:00Z');

function setup() {
  const rows = new Map<string, Project>();
  rows.set('inbox', {
    id: 'inbox',
    workspaceId: 'w1',
    kind: 'inbox',
    name: 'Inbox',
    description: null,
    color: 'slate',
    status: 'active',
    position: 'a0',
    archivedAt: null,
    deletedAt: null,
    deletedBatchId: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
  let seq = 0;
  const repo: ProjectRepository = {
    async insert(_s, p) {
      const project: Project = {
        ...rows.get('inbox')!,
        id: p.id,
        kind: 'standard',
        name: p.name,
        description: p.description,
        color: p.color,
        position: p.position,
      };
      rows.set(p.id, project);
      return project;
    },
    findById: async (_s, id) => rows.get(id) ?? null,
    async update(_s, id, version, changes) {
      const p = rows.get(id);
      if (!p || p.version !== version) return null;
      const next = { ...p, ...changes, version: p.version + 1 } as Project;
      rows.set(id, next);
      return next;
    },
    list: async () =>
      [...rows.values()]
        .filter((p) => p.kind === 'standard')
        .sort((a, b) => (a.position < b.position ? -1 : 1)),
    lastPosition: async () =>
      [...rows.values()]
        .map((p) => p.position)
        .sort()
        .at(-1) ?? null,
  };
  return { rows, deps: { projects: repo, clock: fixedClock(now), newId: () => `p${++seq}` } };
}

const value = <T>(r: { ok: boolean; value?: T }) => {
  if (!r.ok) throw new Error('beklenmeyen hata');
  return r.value as T;
};
const error = (r: { ok: boolean; error?: unknown }) => {
  if (r.ok) throw new Error('hata bekleniyordu');
  return r.error;
};

describe('projeler (FR-PROJ-01..05)', () => {
  it('BR-PROJ-001: ad kırpılır, 1–120 karakter; aynı ad serbest', async () => {
    expect(normalizeProjectName('  Ev\nişleri ')).toEqual({ ok: true, value: 'Ev işleri' });
    expect(normalizeProjectName('   ').ok).toBe(false);
    expect(normalizeProjectName('x'.repeat(121)).ok).toBe(false);
    const { deps } = setup();
    const a = value(await createProject(deps, scope, { name: 'Ev', color: 'green' }));
    const b = value(await createProject(deps, scope, { name: 'Ev' }));
    expect(a).toMatchObject({ name: 'Ev', color: 'green', status: 'active' });
    expect(b.color).toBe('slate');
    expect(a.position < b.position).toBe(true);
  });

  it('BR-PROJ-003: görev yoksa ilerleme gösterilmez', () => {
    expect(progressPercent({ done: 0, total: 0 })).toBeNull();
    expect(progressPercent({ done: 2, total: 6 })).toBe(33);
  });

  it('BR-PROJ-006: Inbox yeniden adlandırılamaz, arşivlenemez, sıralanamaz', async () => {
    const { deps } = setup();
    expect(
      error(await updateProject(deps, scope, 'inbox', { version: 1, name: 'X' })),
    ).toMatchObject({ rule: 'BR-PROJ-006' });
    expect(error(await archiveProject(deps, scope, 'inbox', { version: 1 }))).toMatchObject({
      rule: 'BR-PROJ-006',
    });
    expect(error(await reorderProject(deps, scope, { id: 'inbox' }))).toMatchObject({
      rule: 'BR-PROJ-006',
    });
  });

  it('BR-PROJ-004: arşivli proje düzenlenemez; arşivden çıkınca düzenlenir; BR-TASK-010 sürüm çakışması', async () => {
    const { deps } = setup();
    const p = value(await createProject(deps, scope, { name: 'İş' }));
    const archived = value(await archiveProject(deps, scope, p.id, { version: p.version }));
    expect(archived.archivedAt).toEqual(now);
    expect(
      error(await updateProject(deps, scope, p.id, { version: archived.version, name: 'Y' })),
    ).toMatchObject({ rule: 'BR-PROJ-004' });
    const back = value(await unarchiveProject(deps, scope, p.id, { version: archived.version }));
    expect(
      value(await updateProject(deps, scope, p.id, { version: back.version, status: 'on_hold' })),
    ).toMatchObject({ status: 'on_hold' });
    expect(error(await updateProject(deps, scope, p.id, { version: 1, name: 'Z' }))).toMatchObject({
      kind: 'version_conflict',
    });
  });

  it('FR-PROJ-04: manuel sıra — proje komşularının arasına taşınır', async () => {
    const { deps, rows } = setup();
    const a = value(await createProject(deps, scope, { name: 'A' }));
    const b = value(await createProject(deps, scope, { name: 'B' }));
    const c = value(await createProject(deps, scope, { name: 'C' }));
    value(await reorderProject(deps, scope, { id: c.id, beforeId: b.id, afterId: a.id }));
    const order = [...rows.values()]
      .filter((p) => p.kind === 'standard')
      .sort((x, y) => (x.position < y.position ? -1 : 1))
      .map((p) => p.name);
    expect(order).toEqual(['A', 'C', 'B']);
  });
});
