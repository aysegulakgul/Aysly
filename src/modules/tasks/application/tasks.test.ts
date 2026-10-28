import { describe, expect, it } from 'vitest';
import type { WorkspaceScope } from '@/modules/workspaces';
import { fixedClock } from '@/shared/kernel/clock';
import type { Task } from '../domain/task';
import type { ProjectRef, TaskRepository } from './ports';
import { completeTask, createTask, reopenTask, updateTask, type TaskDeps } from './tasks';

const scope = { userId: 'u1', workspaceId: 'w1', role: 'owner' } as WorkspaceScope;
const INBOX: ProjectRef = { id: 'inbox', kind: 'inbox', archived: false };

/** Bellekte, kapsamı uygulayan sahte depo. */
function setup(projects: ProjectRef[] = []) {
  const rows = new Map<string, Task>();
  let seq = 0;
  const repo: TaskRepository = {
    async insert(s, t) {
      const task: Task = {
        id: t.id,
        workspaceId: s.workspaceId,
        projectId: t.projectId,
        parentTaskId: t.parentTaskId,
        title: t.title,
        description: t.description,
        status: 'todo',
        priority: t.priority,
        startDate: t.startDate,
        due: t.due,
        completedAt: null,
        completedBy: null,
        position: t.position,
        createdBy: t.createdBy,
        archivedAt: null,
        deletedAt: null,
        version: 1,
        createdAt: t.now,
        updatedAt: t.now,
      };
      rows.set(task.id, task);
      return task;
    },
    findById: async (s, id) => {
      const t = rows.get(id);
      return t && t.workspaceId === s.workspaceId && !t.deletedAt ? t : null;
    },
    async update(s, id, version, changes, now) {
      const t = rows.get(id);
      if (!t || t.workspaceId !== s.workspaceId || t.version !== version) return null;
      const next = { ...t, ...changes, version: t.version + 1, updatedAt: now } as Task;
      rows.set(id, next);
      return next;
    },
    lastPosition: async (_s, projectId) =>
      [...rows.values()]
        .filter((t) => t.projectId === projectId)
        .map((t) => t.position)
        .sort()
        .at(-1) ?? null,
    list: async () => [...rows.values()],
  };
  const deps: TaskDeps = {
    tasks: repo,
    projects: {
      find: async (_s, id) => projects.find((p) => p.id === id) ?? null,
      inbox: async () => INBOX,
    },
    clock: fixedClock(new Date('2026-10-28T09:00:00Z')),
    newId: () => `t${++seq}`,
  };
  return { deps, rows };
}

const value = <T>(r: { ok: boolean; value?: T }) => {
  if (!r.ok) throw new Error('beklenmeyen hata');
  return r.value as T;
};

describe('createTask', () => {
  it('BR-TASK-002: proje verilmezse Inbox; BR-TASK-006: sona eklenir; BR-TASK-001: başlık kırpılır', async () => {
    const { deps } = setup();
    const a = value(await createTask(deps, scope, { title: '  Fatura\nöde  ' }));
    const b = value(await createTask(deps, scope, { title: 'İkinci' }));
    expect(a).toMatchObject({
      projectId: 'inbox',
      title: 'Fatura öde',
      status: 'todo',
      priority: 0,
    });
    expect(b.position > a.position).toBe(true);
  });

  it('BR-TASK-001: boş başlık, BR-DATE-002: başlangıç son tarihten sonra → alan hataları', async () => {
    const { deps, rows } = setup();
    const result = await createTask(deps, scope, {
      title: '   ',
      startDate: '2026-11-02',
      due: { date: '2026-11-01' },
    });
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'validation',
        issues: [
          { field: 'title', reason: 'required' },
          { field: 'startDate', reason: 'after_due_date' },
        ],
      },
    });
    expect(rows.size).toBe(0);
  });

  it('BR-PROJ-004: arşivlenmiş projeye görev eklenmez; bilinmeyen proje bulunamadı', async () => {
    const { deps } = setup([{ id: 'p1', kind: 'standard', archived: true }]);
    expect(await createTask(deps, scope, { title: 'x', projectId: 'p1' })).toEqual({
      ok: false,
      error: { kind: 'business_rule', rule: 'BR-PROJ-004' },
    });
    expect(await createTask(deps, scope, { title: 'x', projectId: 'yok' })).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    });
  });

  it('BR-DATE-001: saatli son tarihin mutlak anı hesaplanır', async () => {
    const { deps } = setup();
    const task = value(
      await createTask(deps, scope, {
        title: 'Kira',
        due: { date: '2026-11-01', time: '10:00', timezone: 'Europe/Istanbul' },
      }),
    );
    expect(task.due?.at?.toISOString()).toBe('2026-11-01T07:00:00.000Z');
  });
});

describe('updateTask', () => {
  it('BR-TASK-010: eski sürümle güncelleme çakışma döner ve güncel kaydı içerir', async () => {
    const { deps } = setup();
    const t = value(await createTask(deps, scope, { title: 'A' }));
    value(await updateTask(deps, scope, t.id, { version: 1, title: 'B' }));
    const stale = await updateTask(deps, scope, t.id, { version: 1, title: 'C' });
    expect(stale).toMatchObject({
      ok: false,
      error: { kind: 'version_conflict', current: { title: 'B', version: 2 } },
    });
  });

  it('BR-TASK-003: durum "done" yalnızca tamamlamayla; diğer geçişler serbest', async () => {
    const { deps } = setup();
    const t = value(await createTask(deps, scope, { title: 'A' }));
    expect(await updateTask(deps, scope, t.id, { version: 1, status: 'done' })).toMatchObject({
      error: { issues: [{ field: 'status', reason: 'use_complete_or_reopen' }] },
    });
    expect(
      value(await updateTask(deps, scope, t.id, { version: 1, status: 'in_progress' })),
    ).toMatchObject({
      status: 'in_progress',
    });
  });

  it('BR-DATE-002: yalnızca son tarih değişse de mevcut başlangıç tarihiyle denetlenir', async () => {
    const { deps } = setup();
    const t = value(await createTask(deps, scope, { title: 'A', startDate: '2026-11-05' }));
    expect(
      await updateTask(deps, scope, t.id, { version: 1, due: { date: '2026-11-01' } }),
    ).toMatchObject({ error: { issues: [{ field: 'startDate', reason: 'after_due_date' }] } });
  });

  it('BR-DEL-002: arşivlenmiş görev değiştirilemez', async () => {
    const { deps, rows } = setup();
    const t = value(await createTask(deps, scope, { title: 'A' }));
    rows.set(t.id, { ...t, archivedAt: deps.clock.now() });
    expect(await updateTask(deps, scope, t.id, { version: 1, title: 'B' })).toEqual({
      ok: false,
      error: { kind: 'business_rule', rule: 'BR-DEL-002' },
    });
  });

  it('BR-PERM-001: başka çalışma alanının görevi bulunamadı', async () => {
    const { deps } = setup();
    const t = value(await createTask(deps, scope, { title: 'A' }));
    const other = { ...scope, workspaceId: 'w2' } as WorkspaceScope;
    expect(await updateTask(deps, other, t.id, { version: 1, title: 'B' })).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    });
  });
});

describe('tamamlama', () => {
  it('BR-TASK-004: tamamlama zaman ve aktörü yazar; yeniden açma temizler', async () => {
    const { deps } = setup();
    const t = value(await createTask(deps, scope, { title: 'A' }));
    const done = value(await completeTask(deps, scope, t.id, { version: 1 }));
    expect(done).toMatchObject({ status: 'done', completedBy: 'u1', version: 2 });
    expect(done.completedAt?.toISOString()).toBe('2026-10-28T09:00:00.000Z');
    // Zaten tamamlanmışsa değişiklik yok (sürüm artmaz)
    expect(value(await completeTask(deps, scope, t.id, { version: 2 })).version).toBe(2);
    const reopened = value(await reopenTask(deps, scope, t.id, { version: 2 }));
    expect(reopened).toMatchObject({ status: 'todo', completedAt: null, completedBy: null });
  });
});
