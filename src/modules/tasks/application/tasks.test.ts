import { describe, expect, it } from 'vitest';
import type { WorkspaceScope } from '@/modules/workspaces';
import { fixedClock } from '@/shared/kernel/clock';
import type { Task } from '../domain/task';
import {
  archiveTask,
  deleteTask,
  listTrash,
  purgeTrash,
  restoreFromTrash,
  unarchiveTask,
} from './lifecycle';
import { detachTask, moveTask, myTasks } from './organize';
import type { ProjectRef, TaskRepository } from './ports';
import {
  completeTask,
  createTask,
  inboxBadge,
  reopenTask,
  updateTask,
  type TaskDeps,
} from './tasks';

const scope = { userId: 'u1', workspaceId: 'w1', role: 'owner' } as WorkspaceScope;
const INBOX: ProjectRef = { id: 'inbox', name: 'Inbox', kind: 'inbox', archived: false };

/** Bellekte, kapsamı uygulayan sahte depo. */
function setup(projects: ProjectRef[] = [], tagCount = 0) {
  const rows = new Map<string, Task>();
  const tagLinks = new Map<string, string[]>();
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
        deletedBatchId: null,
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
    countOpen: async (s, projectId) =>
      [...rows.values()].filter(
        (t) =>
          t.workspaceId === s.workspaceId &&
          t.projectId === projectId &&
          t.status !== 'done' &&
          !t.archivedAt &&
          !t.deletedAt &&
          !t.parentTaskId,
      ).length,
    listOpenInProjects: async (s, ids) =>
      [...rows.values()].filter(
        (t) =>
          t.workspaceId === s.workspaceId &&
          ids.includes(t.projectId) &&
          t.status !== 'done' &&
          !t.archivedAt &&
          !t.deletedAt &&
          !t.parentTaskId,
      ),
    listSubtasks: async (s, parentId) =>
      [...rows.values()].filter(
        (t) => t.workspaceId === s.workspaceId && t.parentTaskId === parentId,
      ),
    subtaskCounts: async (s, ids) => {
      const map = new Map<string, { total: number; done: number }>();
      for (const t of rows.values()) {
        if (t.workspaceId !== s.workspaceId || !t.parentTaskId || !ids.includes(t.parentTaskId))
          continue;
        const c = map.get(t.parentTaskId) ?? { total: 0, done: 0 };
        map.set(t.parentTaskId, {
          total: c.total + 1,
          done: c.done + (t.status === 'done' ? 1 : 0),
        });
      }
      return map;
    },
    completeOpenSubtasks: async (_s, parentId, now, actorId) => {
      for (const t of rows.values()) {
        if (t.parentTaskId === parentId && t.status !== 'done') {
          rows.set(t.id, {
            ...t,
            status: 'done',
            completedAt: now,
            completedBy: actorId,
            version: t.version + 1,
          });
        }
      }
    },
    findAny: async (s, id) => {
      const t = rows.get(id);
      return t && t.workspaceId === s.workspaceId ? t : null;
    },
    setArchived: async (_s, ids, archivedAt) => {
      for (const id of ids) {
        const t = rows.get(id)!;
        rows.set(id, { ...t, archivedAt, version: t.version + 1 });
      }
      return ids.length;
    },
    subtasksArchivedWith: async (_s, parentId, archivedAt) =>
      [...rows.values()]
        .filter(
          (t) => t.parentTaskId === parentId && t.archivedAt?.getTime() === archivedAt.getTime(),
        )
        .map((t) => t.id),
    trash: async (_s, ids, batchId, now) => {
      for (const id of ids) {
        const t = rows.get(id)!;
        rows.set(id, { ...t, deletedAt: now, deletedBatchId: batchId, version: t.version + 1 });
      }
      return ids.length;
    },
    restore: async (_s, ids) => {
      for (const id of ids) {
        const t = rows.get(id)!;
        rows.set(id, { ...t, deletedAt: null, deletedBatchId: null, version: t.version + 1 });
      }
      return ids.length;
    },
    batchMembers: async (_s, batchId) =>
      [...rows.values()].filter((t) => t.deletedBatchId === batchId && t.deletedAt),
    listTrash: async () => [...rows.values()].filter((t) => t.deletedAt),
    purge: async (_s, batchId) => {
      let n = 0;
      for (const t of [...rows.values()]) {
        if (t.deletedAt && (batchId === null || t.deletedBatchId === batchId)) {
          rows.delete(t.id);
          n++;
        }
      }
      return n;
    },
    moveSubtasks: async (_s, parentId, projectId) => {
      for (const t of rows.values()) {
        if (t.parentTaskId === parentId)
          rows.set(t.id, { ...t, projectId, version: t.version + 1 });
      }
    },
  };
  const deps: TaskDeps = {
    tasks: repo,
    projects: {
      find: async (_s, id) => projects.find((p) => p.id === id) ?? null,
      inbox: async () => INBOX,
      listActive: async () => [INBOX, ...projects.filter((p) => !p.archived)],
    },
    tags: {
      replace: async (_s, taskId, names) => {
        tagLinks.set(taskId, [...names]);
      },
      forTasks: async (_s, ids) =>
        new Map(
          ids
            .filter((id) => tagLinks.has(id))
            .map((id) => [
              id,
              tagLinks.get(id)!.map((name) => ({ id: name, name, color: 'slate' })),
            ]),
        ),
      missing: async (_s, names) => [...names],
      count: async () => tagCount,
    },
    clock: fixedClock(new Date('2026-10-28T09:00:00Z')),
    newId: () => `t${++seq}`,
  };
  return { deps, rows, tagLinks };
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
    const { deps } = setup([{ id: 'p1', name: 'Ev', kind: 'standard', archived: true }]);
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

describe('inboxBadge', () => {
  it('BR-INBOX-003: Inbox’taki açık, arşivlenmemiş üst düzey görevler sayılır', async () => {
    const { deps, rows } = setup();
    const a = value(await createTask(deps, scope, { title: 'A' }));
    value(await createTask(deps, scope, { title: 'B' }));
    const c = value(await createTask(deps, scope, { title: 'C' }));
    value(await completeTask(deps, scope, a.id, { version: 1 }));
    rows.set(c.id, { ...rows.get(c.id)!, archivedAt: deps.clock.now() });
    expect(await inboxBadge(deps, scope)).toEqual({ ok: true, value: 1 });
  });
});

describe('alt görevler', () => {
  it('BR-SUB-002: alt görev ebeveynin projesini alır; BR-SUB-001: alt görevin alt görevi olamaz', async () => {
    const { deps } = setup([{ id: 'ev', name: 'Ev', kind: 'standard', archived: false }]);
    const parent = value(await createTask(deps, scope, { title: 'Ana', projectId: 'ev' }));
    const child = value(
      await createTask(deps, scope, { title: 'Alt', parentTaskId: parent.id, projectId: 'inbox' }),
    );
    expect(child).toMatchObject({ projectId: 'ev', parentTaskId: parent.id });
    expect(await createTask(deps, scope, { title: 'Torun', parentTaskId: child.id })).toEqual({
      ok: false,
      error: { kind: 'business_rule', rule: 'BR-SUB-001' },
    });
  });

  it('BR-SUB-005: en fazla 100 alt görev', async () => {
    const { deps } = setup();
    const parent = value(await createTask(deps, scope, { title: 'Ana' }));
    for (let i = 0; i < 100; i++)
      await createTask(deps, scope, { title: `A${i}`, parentTaskId: parent.id });
    expect(await createTask(deps, scope, { title: 'Fazla', parentTaskId: parent.id })).toEqual({
      ok: false,
      error: { kind: 'business_rule', rule: 'BR-SUB-005' },
    });
  });

  it('BR-SUB-003: varsayılan yalnızca ana görev; istenirse alt görevler de tamamlanır', async () => {
    const { deps, rows } = setup();
    const parent = value(await createTask(deps, scope, { title: 'Ana' }));
    const a = value(await createTask(deps, scope, { title: 'A', parentTaskId: parent.id }));
    value(await completeTask(deps, scope, parent.id, { version: 1 }));
    expect(rows.get(a.id)?.status).toBe('todo');

    const parent2 = value(await createTask(deps, scope, { title: 'Ana 2' }));
    const b = value(await createTask(deps, scope, { title: 'B', parentTaskId: parent2.id }));
    value(await completeTask(deps, scope, parent2.id, { version: 1, completeSubtasks: true }));
    expect(rows.get(b.id)).toMatchObject({ status: 'done', completedBy: 'u1' });
  });
});

describe('etiketler', () => {
  it('BR-TAG-001: tekrarlar ve # öneki temizlenir; BR-TAG-003: en fazla 20', async () => {
    const { deps, tagLinks } = setup();
    const task = value(
      await createTask(deps, scope, { title: 'A', tagNames: ['#iş', 'İŞ', ' ev '] }),
    );
    expect(tagLinks.get(task.id)).toEqual(['iş', 'ev']);
    const many = Array.from({ length: 21 }, (_, i) => `e${i}`);
    expect(await createTask(deps, scope, { title: 'B', tagNames: many })).toEqual({
      ok: false,
      error: { kind: 'business_rule', rule: 'BR-TAG-003' },
    });
  });

  it('BR-TAG-003: çalışma alanı 500 etiket sınırı yeni etiketi engeller', async () => {
    const { deps } = setup([], 500);
    expect(await createTask(deps, scope, { title: 'A', tagNames: ['yeni'] })).toEqual({
      ok: false,
      error: { kind: 'business_rule', rule: 'BR-TAG-003' },
    });
  });
});

describe('taşıma ve Görevlerim', () => {
  const ev: ProjectRef = { id: 'ev', name: 'Ev', kind: 'standard', archived: false };
  const old: ProjectRef = { id: 'eski', name: 'Eski', kind: 'standard', archived: true };

  it('BR-INBOX-002: taşıma yalnızca projeyi değiştirir; alt görevler birlikte taşınır', async () => {
    const { deps, rows } = setup([ev]);
    const task = value(
      await createTask(deps, scope, { title: 'A', priority: 2, due: { date: '2026-11-01' } }),
    );
    const child = value(await createTask(deps, scope, { title: 'Alt', parentTaskId: task.id }));
    const moved = value(await moveTask(deps, scope, task.id, { version: 1, projectId: 'ev' }));
    expect(moved).toMatchObject({
      projectId: 'ev',
      title: 'A',
      priority: 2,
      due: { date: '2026-11-01' },
    });
    expect(rows.get(child.id)?.projectId).toBe('ev');
  });

  it('BR-SUB-002: alt görev tek başına taşınamaz; BR-PROJ-004: arşivli projeye taşınamaz', async () => {
    const { deps } = setup([ev, old]);
    const task = value(await createTask(deps, scope, { title: 'A' }));
    const child = value(await createTask(deps, scope, { title: 'Alt', parentTaskId: task.id }));
    expect(await moveTask(deps, scope, child.id, { version: 1, projectId: 'ev' })).toEqual({
      ok: false,
      error: { kind: 'business_rule', rule: 'BR-SUB-002' },
    });
    expect(await moveTask(deps, scope, task.id, { version: 1, projectId: 'eski' })).toEqual({
      ok: false,
      error: { kind: 'business_rule', rule: 'BR-PROJ-004' },
    });
    const detached = value(await detachTask(deps, scope, child.id, { version: 1 }));
    expect(detached.parentTaskId).toBeNull();
  });

  it('BR-INBOX-004: Görevlerim açık üst düzey görevleri son tarihe göre gruplar', async () => {
    const { deps } = setup([ev]);
    value(await createTask(deps, scope, { title: 'Geç', due: { date: '2026-10-20' } }));
    value(await createTask(deps, scope, { title: 'Bugün', due: { date: '2026-10-28' } }));
    value(await createTask(deps, scope, { title: 'Tarihsiz', projectId: 'ev' }));
    const result = value(await myTasks(deps, scope, { today: '2026-10-28', weekStart: 1 }));
    expect(result.map((g) => [g.group, g.items.map((i) => i.task.title)])).toEqual([
      ['overdue', ['Geç']],
      ['today', ['Bugün']],
      ['none', ['Tarihsiz']],
    ]);
    expect(result[2]?.items[0]?.project.name).toBe('Ev');
  });
});

describe('arşiv ve çöp kutusu', () => {
  it('BR-DEL-002 / BR-SUB-004: arşivleme alt görevleri kapsar; arşivden çıkarma birlikte geri getirir', async () => {
    const { deps, rows } = setup();
    const parent = value(await createTask(deps, scope, { title: 'Ana' }));
    const child = value(await createTask(deps, scope, { title: 'Alt', parentTaskId: parent.id }));
    const archived = value(await archiveTask(deps, scope, parent.id, { version: 1 }));
    expect(archived.archivedAt).not.toBeNull();
    expect(rows.get(child.id)?.archivedAt).not.toBeNull();
    expect(
      await updateTask(deps, scope, parent.id, { version: archived.version, title: 'X' }),
    ).toEqual({
      ok: false,
      error: { kind: 'business_rule', rule: 'BR-DEL-002' },
    });
    const back = value(await unarchiveTask(deps, scope, parent.id, { version: archived.version }));
    expect(back.archivedAt).toBeNull();
    expect(rows.get(child.id)?.archivedAt).toBeNull();
  });

  it('BR-DEL-006: görev ve alt görevleri tek grupla çöpe gider ve grupla geri yüklenir', async () => {
    const { deps, rows } = setup();
    const parent = value(await createTask(deps, scope, { title: 'Ana' }));
    const child = value(await createTask(deps, scope, { title: 'Alt', parentTaskId: parent.id }));
    const { batchId, affected } = value(await deleteTask(deps, scope, parent.id));
    expect(affected).toBe(2);
    expect(rows.get(child.id)?.deletedBatchId).toBe(batchId);
    const trash = value(await listTrash(deps, scope));
    expect(trash).toMatchObject([{ batchId, root: { id: parent.id }, count: 2, daysLeft: 30 }]);
    expect(value(await restoreFromTrash(deps, scope, { batchId })).restored).toBe(2);
    expect(rows.get(parent.id)?.deletedAt).toBeNull();
  });

  it('BR-SUB-004: ebeveyni çöpteki alt görev yalnızca ebeveyniyle geri yüklenir', async () => {
    const { deps, rows } = setup();
    const parent = value(await createTask(deps, scope, { title: 'Ana' }));
    const child = value(await createTask(deps, scope, { title: 'Alt', parentTaskId: parent.id }));
    value(await deleteTask(deps, scope, parent.id));
    expect(await restoreFromTrash(deps, scope, { id: child.id })).toEqual({
      ok: false,
      error: { kind: 'business_rule', rule: 'BR-SUB-004' },
    });
    value(await restoreFromTrash(deps, scope, { id: child.id, restoreParent: true }));
    expect(rows.get(parent.id)?.deletedAt).toBeNull();
  });

  it('BR-DEL-003: 30 gün dolunca geri yüklenemez; BR-DEL-005: kalıcı silme onay ister', async () => {
    const { deps } = setup();
    const task = value(await createTask(deps, scope, { title: 'A' }));
    const { batchId } = value(await deleteTask(deps, scope, task.id));
    (deps.clock as ReturnType<typeof fixedClock>).advance(30 * 86_400_000);
    expect(await restoreFromTrash(deps, scope, { batchId })).toEqual({
      ok: false,
      error: { kind: 'business_rule', rule: 'BR-DEL-003' },
    });
    expect(value(await listTrash(deps, scope))[0]).toMatchObject({ expired: true, daysLeft: 0 });
    expect(await purgeTrash(deps, scope, { batchId, confirm: false })).toMatchObject({
      ok: false,
      error: { kind: 'validation' },
    });
    expect(value(await purgeTrash(deps, scope, { batchId: null, confirm: true })).purged).toBe(1);
  });
});

describe('BR-SUB-004: ebeveynin tek başına geri yüklenmesi', () => {
  it('aynı gruptaki alt görevler de geri döner', async () => {
    const { deps, rows } = setup();
    const parent = value(await createTask(deps, scope, { title: 'Ana' }));
    const child = value(await createTask(deps, scope, { title: 'Alt', parentTaskId: parent.id }));
    value(await deleteTask(deps, scope, parent.id));
    value(await restoreFromTrash(deps, scope, { id: parent.id }));
    expect(rows.get(child.id)?.deletedAt).toBeNull();
  });
});

describe('yaşam durumları', () => {
  it('BR-DEL-001: çöpteki görev listelerde ve Görevlerim’de görünmez; geri yüklenince döner', async () => {
    const { deps } = setup();
    const task = value(await createTask(deps, scope, { title: 'A' }));
    value(await deleteTask(deps, scope, task.id));
    expect(await getTaskSafe(deps, task.id)).toBe(false);
    expect(value(await myTasks(deps, scope, { today: '2026-10-28', weekStart: 1 }))).toEqual([]);
    value(await restoreFromTrash(deps, scope, { id: task.id }));
    expect(await getTaskSafe(deps, task.id)).toBe(true);
  });

  it('BR-DEL-004: geri yükleme sürümü artırır; projesi artık yoksa görev Inbox’a döner', async () => {
    const ev: ProjectRef = { id: 'ev', name: 'Ev', kind: 'standard', archived: false };
    const projects = [ev];
    const { deps, rows } = setup(projects);
    const task = value(await createTask(deps, scope, { title: 'A', projectId: 'ev' }));
    value(await deleteTask(deps, scope, task.id));
    const before = rows.get(task.id)!.version;
    projects.splice(0, 1); // proje kalıcı silindi
    const result = value(await restoreFromTrash(deps, scope, { id: task.id }));
    expect(result.movedToInbox).toBe(1);
    expect(rows.get(task.id)).toMatchObject({ projectId: 'inbox', deletedAt: null });
    expect(rows.get(task.id)!.version).toBeGreaterThan(before);
  });
});

async function getTaskSafe(deps: TaskDeps, id: string) {
  return (await deps.tasks.findById(scope, id)) !== null;
}
