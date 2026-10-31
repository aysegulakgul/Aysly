import { describe, expect, it } from 'vitest';
import type { Project } from '@/modules/projects';
import type { Reminder } from '@/modules/reminders';
import { EMPTY_FILTER, type TaskFilter } from '@/modules/views';
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
import { BULK_LIMIT, bulkTasks } from './bulk';
import { dashboard, detachTask, moveTask, myTasks } from './organize';
import {
  archiveContents,
  completeProject,
  deleteProject,
  projectDeletePreview,
  projectOverview,
} from './projects';
import { queryTasks } from './query';
import { addReminder, dispatchDueReminders } from './reminders';
import type { ProjectRef, TaskRepository } from './ports';
import {
  completeTask,
  createTask,
  inboxBadge,
  reopenTask,
  updateTask,
  type TaskDeps,
  SUBTASKS_PER_TASK,
} from './tasks';

const scope = { userId: 'u1', workspaceId: 'w1', role: 'owner' } as WorkspaceScope;
const INBOX: ProjectRef = { id: 'inbox', name: 'Inbox', kind: 'inbox', archived: false };

const toProject = (ref: ProjectRef, i: number): Project => ({
  id: ref.id,
  workspaceId: 'w1',
  kind: ref.kind,
  name: ref.name,
  description: null,
  color: 'slate',
  status: 'active',
  position: `a${i}`,
  archivedAt: ref.archived ? new Date('2026-10-01T00:00:00Z') : null,
  deletedAt: null,
  deletedBatchId: null,
  version: 1,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
});

/** Bellekte, kapsamı uygulayan sahte depo. */
function setup(projects: ProjectRef[] = [], tagCount = 0) {
  const projectRows = new Map<string, Project>(
    [INBOX, ...projects].map((ref, i) => [ref.id, toProject(ref, i)]),
  );
  const refOf = (p: Project): ProjectRef => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    archived: p.archivedAt !== null,
  });
  const liveProject = (id: string) => {
    const p = projectRows.get(id);
    return p && !p.deletedAt ? p : null;
  };
  const rows = new Map<string, Task>();
  const reminderRows = new Map<string, Reminder>();
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
        storyPoints: t.storyPoints ?? null,
        assigneeId: t.assigneeId ?? null,
        startDate: t.startDate,
        due: t.due,
        completedAt: null,
        completedBy: null,
        position: t.position,
        recurrence: t.recurrence ?? null,
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
    countOpenInProjects: async (s, ids, today) => {
      const open = [...rows.values()].filter(
        (t) =>
          t.workspaceId === s.workspaceId &&
          ids.includes(t.projectId) &&
          t.status !== 'done' &&
          !t.archivedAt &&
          !t.deletedAt &&
          !t.parentTaskId,
      );
      return { open: open.length, today: open.filter((t) => t.due?.date === today).length };
    },
    listDoneInProjects: async (s, ids, since) =>
      [...rows.values()].filter(
        (t) =>
          t.workspaceId === s.workspaceId &&
          ids.includes(t.projectId) &&
          t.status === 'done' &&
          (t.completedAt ?? new Date(0)) >= since &&
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
    progressFlags: async (_s, inboxId) => {
      const all = [...rows.values()].filter((t) => !t.deletedAt);
      return {
        hasTask: all.length > 0,
        hasProjectTask: all.some((t) => t.projectId !== inboxId),
        hasDatedTask: all.some((t) => t.due !== null),
      };
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
    query: async (_s, q) =>
      [...rows.values()]
        .filter(
          (t) =>
            !t.deletedAt &&
            q.projectIds.includes(t.projectId) &&
            q.statuses.includes(t.status) &&
            (!q.priorities?.length || q.priorities.includes(t.priority)) &&
            (q.includeArchived || !t.archivedAt) &&
            (!q.topLevelOnly || !t.parentTaskId),
        )
        .sort((a, b) => (a.position < b.position ? -1 : 1)),
    progress: async (_s, projectIds) => {
      const result = new Map<string, { done: number; total: number }>();
      for (const t of rows.values()) {
        if (t.deletedAt || t.archivedAt || t.parentTaskId || !projectIds.includes(t.projectId))
          continue;
        const p = result.get(t.projectId) ?? { done: 0, total: 0 };
        result.set(t.projectId, {
          done: p.done + (t.status === 'done' ? 1 : 0),
          total: p.total + 1,
        });
      }
      return result;
    },
    inProject: async (_s, projectId) =>
      [...rows.values()]
        .filter((t) => !t.deletedAt && t.projectId === projectId)
        .map(({ id, parentTaskId }) => ({ id, parentTaskId })),
    completeOpenInProject: async (_s, projectId, now, actorId) => {
      let n = 0;
      for (const t of rows.values()) {
        if (t.deletedAt || t.archivedAt || t.projectId !== projectId || t.status === 'done')
          continue;
        rows.set(t.id, {
          ...t,
          status: 'done',
          completedAt: now,
          completedBy: actorId,
          version: t.version + 1,
        });
        n++;
      }
      return n;
    },
    reassignTrashed: async (_s, projectIds, inboxId) => {
      for (const t of rows.values()) {
        if (t.deletedAt && projectIds.includes(t.projectId))
          rows.set(t.id, { ...t, projectId: inboxId });
      }
    },
    listArchived: async () => [...rows.values()].filter((t) => !t.deletedAt && t.archivedAt),
    findGeneratedFrom: async (_s, id) =>
      [...rows.values()].find((t) => !t.deletedAt && t.recurrence?.generatedFrom === id) ?? null,
    hardDelete: async (_s, id) => {
      rows.delete(id);
      for (const t of [...rows.values()]) if (t.parentTaskId === id) rows.delete(t.id);
      reminderRows.forEach((r, key) => r.taskId === id && reminderRows.delete(key));
    },
    moveSubtasks: async (_s, parentId, projectId) => {
      for (const t of rows.values()) {
        if (t.parentTaskId === parentId)
          rows.set(t.id, { ...t, projectId, version: t.version + 1 });
      }
    },
  };
  const deps: TaskDeps = {
    contacts: { refs: async () => new Map() },
    tasks: repo,
    projects: {
      find: async (_s, id) => {
        const p = liveProject(id);
        return p ? refOf(p) : null;
      },
      inbox: async () => INBOX,
      listActive: async () =>
        [...projectRows.values()].filter((p) => !p.deletedAt && !p.archivedAt).map(refOf),
      repo: {
        insert: async () => {
          throw new Error('kullanılmaz');
        },
        findById: async (_s, id) => liveProject(id),
        update: async (_s, id, version, changes) => {
          const p = liveProject(id);
          if (!p || p.version !== version) return null;
          const next = { ...p, ...changes, version: p.version + 1 } as Project;
          projectRows.set(id, next);
          return next;
        },
        list: async (_s, filter) =>
          [...projectRows.values()].filter(
            (p) =>
              !p.deletedAt &&
              p.kind === 'standard' &&
              (filter.includeArchived || !p.archivedAt) &&
              (!filter.statuses?.length || filter.statuses.includes(p.status)),
          ),
        lastPosition: async () => null,
      },
      findAny: async (_s, id) => projectRows.get(id) ?? null,
      trash: async (_s, id, batchId, now) => {
        const p = liveProject(id);
        if (!p || p.kind === 'inbox') return false;
        projectRows.set(id, { ...p, deletedAt: now, deletedBatchId: batchId });
        return true;
      },
      restore: async (_s, ids) => {
        for (const id of ids) {
          const p = projectRows.get(id)!;
          projectRows.set(id, { ...p, deletedAt: null, deletedBatchId: null });
        }
        return ids.length;
      },
      listTrashed: async (_s, batchId) =>
        [...projectRows.values()].filter(
          (p) => p.deletedAt && (batchId === undefined || p.deletedBatchId === batchId),
        ),
      purge: async (_s, batchId) => {
        let n = 0;
        for (const p of [...projectRows.values()]) {
          if (p.deletedAt && (batchId === null || p.deletedBatchId === batchId)) {
            projectRows.delete(p.id);
            n++;
          }
        }
        return n;
      },
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
      existing: async (_s, ids) =>
        new Set(ids.filter((id) => [...tagLinks.values()].some((names) => names.includes(id)))),
      taskIdsWithTags: async (_s, ids, mode) =>
        new Set(
          [...tagLinks.entries()]
            .filter(([, names]) =>
              mode === 'all'
                ? ids.every((id) => names.includes(id))
                : ids.some((id) => names.includes(id)),
            )
            .map(([taskId]) => taskId),
        ),
    },
    reminders: {
      forTasks: async (_s, ids) => {
        const map = new Map<string, Reminder[]>();
        for (const r of [...reminderRows.values()].sort((a, b) => +a.remindAt - +b.remindAt)) {
          if (ids.includes(r.taskId)) map.set(r.taskId, [...(map.get(r.taskId) ?? []), r]);
        }
        return map;
      },
      insert: async (_s, r) => {
        const reminder: Reminder = {
          id: r.id,
          taskId: r.taskId,
          kind: r.kind,
          offsetMinutes: r.offsetMinutes,
          remindAt: r.remindAt,
          status: r.status,
          sentAt: null,
        };
        reminderRows.set(r.id, reminder);
        return reminder;
      },
      remove: async (_s, taskId, id) =>
        reminderRows.get(id)?.taskId === taskId ? reminderRows.delete(id) : false,
      retime: async (_s, id, remindAt, status) => {
        reminderRows.set(id, { ...reminderRows.get(id)!, remindAt, status });
      },
      removeRelative: async (_s, taskId) => {
        reminderRows.forEach(
          (r, key) => r.taskId === taskId && r.kind === 'relative' && reminderRows.delete(key),
        );
      },
      cancel: async (_s, ids) => {
        reminderRows.forEach((r, key) => {
          if (ids.includes(r.taskId) && r.status === 'pending')
            reminderRows.set(key, { ...r, status: 'canceled' });
        });
      },
      reactivate: async (_s, ids, now) => {
        reminderRows.forEach((r, key) => {
          if (ids.includes(r.taskId) && r.status === 'canceled' && r.remindAt > now)
            reminderRows.set(key, { ...r, status: 'pending' });
        });
      },
    },
    calendar: {
      of: async () => ({ timezone: 'Europe/Istanbul', allDayReminderTime: '09:00', weekStart: 1 }),
    },
    clock: fixedClock(new Date('2026-10-28T09:00:00Z')),
    newId: () => `t${++seq}`,
  };
  return { deps, rows, tagLinks, projectRows, reminderRows };
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

  it('BR-SUB-005 / D-103: en fazla 1.000 alt görev', async () => {
    const { deps } = setup();
    const parent = value(await createTask(deps, scope, { title: 'Ana' }));
    for (let i = 0; i < SUBTASKS_PER_TASK; i++)
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
    const { deps, rows, projectRows } = setup([ev]);
    const task = value(await createTask(deps, scope, { title: 'A', projectId: 'ev' }));
    value(await deleteTask(deps, scope, task.id));
    const before = rows.get(task.id)!.version;
    projectRows.delete('ev'); // proje kalıcı silindi
    const result = value(await restoreFromTrash(deps, scope, { id: task.id }));
    expect(result.movedToInbox).toBe(1);
    expect(rows.get(task.id)).toMatchObject({ projectId: 'inbox', deletedAt: null });
    expect(rows.get(task.id)!.version).toBeGreaterThan(before);
  });
});

async function getTaskSafe(deps: TaskDeps, id: string) {
  return (await deps.tasks.findById(scope, id)) !== null;
}

describe('dashboard', () => {
  it('BR-DASH-002 / FR-DASH: bugün, geciken (en eski önce), yaklaşan (7 gün) ve öncelikli', async () => {
    const { deps } = setup();
    // fixedClock: 2026-10-28T09:00Z → İstanbul 12:00
    const mk = async (title: string, due?: { date: string; time?: string }, priority = 0) =>
      value(
        await createTask(deps, scope, {
          title,
          priority: priority as 0 | 1 | 2 | 3,
          ...(due ? { due: { ...due, ...(due.time ? { timezone: 'Europe/Istanbul' } : {}) } } : {}),
        }),
      );
    await mk('Eski', { date: '2026-10-20' });
    await mk('Daha eski', { date: '2026-10-10' });
    await mk('Bugün tüm gün', { date: '2026-10-28' });
    await mk('Bugün 15:00', { date: '2026-10-28', time: '15:00' }, 3);
    await mk('Bugün 10:00', { date: '2026-10-28', time: '10:00' }); // geçti → geciken
    await mk('Yarın', { date: '2026-10-29' });
    await mk('7 gün sonra', { date: '2026-11-04' });
    await mk('8 gün sonra', { date: '2026-11-05' });
    const d = value(await dashboard(deps, scope, { today: '2026-10-28', weekStart: 1 }));
    const titles = (items: { task: { title: string } }[]) => items.map((i) => i.task.title);
    expect(titles(d.today)).toEqual(['Bugün 15:00', 'Bugün tüm gün']);
    expect(titles(d.overdue)).toEqual(['Daha eski', 'Eski', 'Bugün 10:00']);
    expect(titles(d.upcoming)).toEqual(['Yarın', '7 gün sonra']);
    expect(titles(d.priority)).toEqual(['Bugün 15:00']);
  });
});

const EV: ProjectRef = { id: 'ev', name: 'Ev', kind: 'standard', archived: false };
const IS: ProjectRef = { id: 'is', name: 'İş', kind: 'standard', archived: false };
const failure = (r: { ok: boolean; error?: unknown }) => {
  if (r.ok) throw new Error('hata bekleniyordu');
  return r.error as { kind: string; rule?: string; failures?: { id: string; rule?: string }[] };
};

describe('Faz 5 — projeler ve görevler', () => {
  it('BR-PROJ-003: ilerleme = tamamlanan / arşivlenmemiş üst düzey görev; alt görevler sayılmaz', async () => {
    const { deps } = setup([EV]);
    const a = value(await createTask(deps, scope, { title: 'A', projectId: 'ev' }));
    value(await createTask(deps, scope, { title: 'B', projectId: 'ev' }));
    value(await createTask(deps, scope, { title: 'Alt', parentTaskId: a.id }));
    const c = value(await createTask(deps, scope, { title: 'C', projectId: 'ev' }));
    value(await completeTask(deps, scope, a.id, { version: a.version }));
    value(await archiveTask(deps, scope, c.id, { version: c.version }));
    const [ev] = value(await projectOverview(deps, scope, {}));
    expect(ev?.progress).toEqual({ done: 1, total: 2 });
  });

  it('BR-PROJ-004: arşivli projedeki görev düzenlenemez, eklenemez, taşınamaz, tek başına silinemez', async () => {
    const { deps, rows } = setup([{ ...EV, archived: true }, IS]);
    const created = value(await createTask(deps, scope, { title: 'X', projectId: 'is' }));
    rows.set(created.id, { ...created, projectId: 'ev' });
    const id = created.id;
    expect(failure(await updateTask(deps, scope, id, { version: 1, title: 'Yeni' }))).toMatchObject(
      {
        rule: 'BR-PROJ-004',
      },
    );
    expect(failure(await completeTask(deps, scope, id, { version: 1 }))).toMatchObject({
      rule: 'BR-PROJ-004',
    });
    expect(failure(await moveTask(deps, scope, id, { version: 1, projectId: 'is' }))).toMatchObject(
      {
        rule: 'BR-PROJ-004',
      },
    );
    expect(failure(await deleteTask(deps, scope, id))).toMatchObject({ rule: 'BR-PROJ-004' });
    expect(
      failure(await createTask(deps, scope, { title: 'Yeni', projectId: 'ev' })),
    ).toMatchObject({ rule: 'BR-PROJ-004' });
  });

  it('BR-PROJ-005 / AC-06: proje ve görevleri tek grupla çöpe gider, grup geri yüklenince hepsi döner', async () => {
    const { deps, rows, projectRows } = setup([EV]);
    const ids: string[] = [];
    for (const title of ['1', '2', '3', '4', '5']) {
      ids.push(value(await createTask(deps, scope, { title, projectId: 'ev' })).id);
    }
    value(await createTask(deps, scope, { title: 'Alt', parentTaskId: ids[0]! }));
    expect(value(await projectDeletePreview(deps, scope, 'ev'))).toEqual({
      tasks: 6,
      topLevel: 5,
      subtasks: 1,
    });
    const deleted = value(await deleteProject(deps, scope, 'ev'));
    expect(deleted.affected.tasks).toBe(6);
    expect(projectRows.get('ev')?.deletedBatchId).toBe(deleted.batchId);
    expect(value(await projectOverview(deps, scope, {}))).toHaveLength(0);
    const groups = value(await listTrash(deps, scope));
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ root: { type: 'project', id: 'ev' }, count: 6 });

    value(await restoreFromTrash(deps, scope, { batchId: deleted.batchId }));
    expect(projectRows.get('ev')?.deletedAt).toBeNull();
    expect(
      ids.every((id) => rows.get(id)?.deletedAt === null && rows.get(id)?.projectId === 'ev'),
    ).toBe(true);
  });

  it('BR-PROJ-005: önceden ayrı silinen görev kendi grubunda kalır; BR-DEL-004: projesi çöpteyse seçim ister', async () => {
    const { deps, rows } = setup([EV]);
    const early = value(await createTask(deps, scope, { title: 'Önce', projectId: 'ev' }));
    const own = value(await deleteTask(deps, scope, early.id));
    const project = value(await deleteProject(deps, scope, 'ev'));
    expect(project.affected.tasks).toBe(0);
    expect(rows.get(early.id)?.deletedBatchId).toBe(own.batchId);
    expect(value(await listTrash(deps, scope))).toHaveLength(2);

    expect(failure(await restoreFromTrash(deps, scope, { batchId: own.batchId }))).toMatchObject({
      rule: 'BR-DEL-004',
    });
    const toInbox = value(
      await restoreFromTrash(deps, scope, { batchId: own.batchId, projectChoice: 'inbox' }),
    );
    expect(toInbox.movedToInbox).toBe(1);
    expect(rows.get(early.id)?.projectId).toBe('inbox');
  });

  it('BR-DEL-005: proje grubu kalıcı silinirken başka gruptaki görevi Inbox’a bağlanır', async () => {
    const { deps, rows, projectRows } = setup([EV]);
    const early = value(await createTask(deps, scope, { title: 'Önce', projectId: 'ev' }));
    value(await deleteTask(deps, scope, early.id));
    const project = value(await deleteProject(deps, scope, 'ev'));
    value(await purgeTrash(deps, scope, { batchId: project.batchId, confirm: true }));
    expect(projectRows.has('ev')).toBe(false);
    expect(rows.get(early.id)).toMatchObject({ projectId: 'inbox' });
    expect(rows.get(early.id)?.deletedAt).not.toBeNull();
  });

  it('BR-PROJ-006: Inbox silinemez', async () => {
    const { deps } = setup();
    expect(failure(await deleteProject(deps, scope, 'inbox'))).toMatchObject({
      rule: 'BR-PROJ-006',
    });
  });

  it('BR-PROJ-002: "hepsini tamamla" açık görevleri de tamamlar; "olduğu gibi bırak" görevlere dokunmaz', async () => {
    const { deps, rows } = setup([EV, IS]);
    const a = value(await createTask(deps, scope, { title: 'A', projectId: 'ev' }));
    const b = value(await createTask(deps, scope, { title: 'B', projectId: 'is' }));
    const kept = value(
      await completeProject(deps, scope, 'is', { version: 1, completeOpenTasks: false }),
    );
    expect(kept.project.status).toBe('completed');
    expect(rows.get(b.id)?.status).toBe('todo');
    const all = value(
      await completeProject(deps, scope, 'ev', { version: 1, completeOpenTasks: true }),
    );
    expect(all.completedTasks).toBe(1);
    expect(rows.get(a.id)?.status).toBe('done');
  });

  it('Arşiv sayfası (BR-DEL-001): arşivli projeler ve tek başına arşivlenen görevler', async () => {
    const { deps } = setup([{ ...EV, archived: true }, IS]);
    const t = value(await createTask(deps, scope, { title: 'T', projectId: 'is' }));
    value(await archiveTask(deps, scope, t.id, { version: t.version }));
    const archive = value(await archiveContents(deps, scope));
    expect(archive.projects.map((p) => p.project.id)).toEqual(['ev']);
    expect(archive.tasks.map((x) => x.task.id)).toEqual([t.id]);
  });

  it('BR-TASK-006: sıra içi taşıma yalnızca taşınan görevin konumunu değiştirir', async () => {
    const { deps, rows } = setup([EV]);
    const a = value(await createTask(deps, scope, { title: 'A', projectId: 'ev' }));
    const b = value(await createTask(deps, scope, { title: 'B', projectId: 'ev' }));
    const c = value(await createTask(deps, scope, { title: 'C', projectId: 'ev' }));
    value(await moveTask(deps, scope, c.id, { version: c.version, afterId: a.id, beforeId: b.id }));
    const order = [...rows.values()]
      .filter((t) => t.projectId === 'ev')
      .sort((x, y) => (x.position < y.position ? -1 : 1))
      .map((t) => t.title);
    expect(order).toEqual(['A', 'C', 'B']);
    expect(rows.get(a.id)?.position).toBe(a.position);
  });
});

describe('Faz 5 — görünümler (BR-VIEW-001/002)', () => {
  const context = { today: '2026-10-28', weekStart: 1, viewType: 'list' as const };
  const settings = { sort: 'manual' as const, groupBy: 'none' as const };
  const filter = (f: Partial<TaskFilter>): TaskFilter => ({ ...EMPTY_FILTER, ...f });

  it('BR-VIEW-002: liste açık görevleri, pano tüm durumları gösterir; filtreler aynıdır', async () => {
    const { deps } = setup([EV]);
    const a = value(await createTask(deps, scope, { title: 'A', projectId: 'ev', priority: 3 }));
    value(await createTask(deps, scope, { title: 'B', projectId: 'ev', priority: 1 }));
    value(await completeTask(deps, scope, a.id, { version: a.version }));
    const list = value(
      await queryTasks(deps, scope, filter({ projectId: ['ev'] }), settings, context),
    );
    const board = value(
      await queryTasks(deps, scope, filter({ projectId: ['ev'] }), settings, {
        ...context,
        viewType: 'board',
      }),
    );
    expect(list.items.map((i) => i.task.title)).toEqual(['B']);
    expect(board.items.map((i) => i.task.title)).toEqual(['A', 'B']);
    const high = value(
      await queryTasks(deps, scope, filter({ priority: [3], status: ['done'] }), settings, context),
    );
    expect(high.items.map((i) => i.task.title)).toEqual(['A']);
  });

  it('FR-VIEW-04/05: tarih, metin ve etiket filtreleri; son tarihe ve başlığa göre sıralama', async () => {
    const { deps } = setup([EV]);
    value(
      await createTask(deps, scope, {
        title: 'Zeytin',
        due: { date: '2026-10-28' },
        tagNames: ['ev'],
      }),
    );
    value(await createTask(deps, scope, { title: 'Armut', due: { date: '2026-10-27' } }));
    value(await createTask(deps, scope, { title: 'Çay' }));
    const overdue = value(
      await queryTasks(deps, scope, filter({ due: 'overdue' }), settings, context),
    );
    expect(overdue.items.map((i) => i.task.title)).toEqual(['Armut']);
    const undated = value(
      await queryTasks(deps, scope, filter({ due: 'none' }), settings, context),
    );
    expect(undated.items.map((i) => i.task.title)).toEqual(['Çay']);
    const text = value(await queryTasks(deps, scope, filter({ q: 'ZEYTİN' }), settings, context));
    expect(text.items.map((i) => i.task.title)).toEqual(['Zeytin']);
    const byDue = value(
      await queryTasks(deps, scope, EMPTY_FILTER, { ...settings, sort: 'due' }, context),
    );
    expect(byDue.items.map((i) => i.task.title)).toEqual(['Armut', 'Zeytin', 'Çay']);
    const byTitle = value(
      await queryTasks(deps, scope, EMPTY_FILTER, { ...settings, sort: 'title' }, context),
    );
    expect(byTitle.items.map((i) => i.task.title)).toEqual(['Armut', 'Çay', 'Zeytin']);
    const tagged = value(
      await queryTasks(deps, scope, filter({ tagId: ['ev'] }), settings, context),
    );
    expect(tagged.items.map((i) => i.task.title)).toEqual(['Zeytin']);
  });

  it('BR-VIEW-001: silinmiş proje veya etikete referans yok sayılır ve bildirilir', async () => {
    const { deps } = setup([EV]);
    value(await createTask(deps, scope, { title: 'A', projectId: 'ev' }));
    const result = value(
      await queryTasks(
        deps,
        scope,
        filter({
          projectId: ['01900000-0000-7000-8000-00000000dead'],
          tagId: ['01900000-0000-7000-8000-00000000beef'],
        }),
        settings,
        context,
      ),
    );
    expect(result.ignored).toEqual(['projectId', 'tagId']);
    expect(result.items.map((i) => i.task.title)).toEqual(['A']);
  });

  it('BR-PROJ-004: arşivli projenin görevleri varsayılan görünümde yok, "arşivi dahil et" ile var', async () => {
    const { deps, rows } = setup([{ ...EV, archived: true }]);
    const created = value(await createTask(deps, scope, { title: 'X' }));
    rows.set(created.id, { ...created, projectId: 'ev' });
    const hidden = value(await queryTasks(deps, scope, EMPTY_FILTER, settings, context));
    expect(hidden.items.map((i) => i.task.id)).not.toContain(created.id);
    const shown = value(
      await queryTasks(deps, scope, filter({ includeArchived: true }), settings, context),
    );
    expect(shown.items.map((i) => i.task.id)).toContain(created.id);
  });
});

describe('Faz 5 — toplu işlemler (BR-TASK-008, D-084)', () => {
  it('BR-TASK-008: bir görev reddedilirse tüm hatalar listelenir (çağıran işlemi geri alır)', async () => {
    const { deps } = setup([EV]);
    const a = value(await createTask(deps, scope, { title: 'A' }));
    const parent = value(await createTask(deps, scope, { title: 'P' }));
    const sub = value(await createTask(deps, scope, { title: 'Alt', parentTaskId: parent.id }));
    const error = failure(
      await bulkTasks(deps, scope, {
        action: 'move',
        projectId: 'ev',
        taskIds: [a.id, sub.id, 'yok'],
      }),
    );
    expect(error.kind).toBe('bulk_rejected');
    expect(error.failures).toEqual([
      { id: sub.id, code: 'BUSINESS_RULE_VIOLATION', rule: 'BR-SUB-002' },
      { id: 'yok', code: 'NOT_FOUND' },
    ]);
  });

  it('AC-02: seçilen iki görev projeye taşınır; tarih ve etiketler korunur', async () => {
    const { deps, rows, tagLinks } = setup([EV]);
    const a = value(
      await createTask(deps, scope, { title: 'A', due: { date: '2026-11-01' }, tagNames: ['x'] }),
    );
    const b = value(await createTask(deps, scope, { title: 'B' }));
    value(await createTask(deps, scope, { title: 'C' }));
    const done = value(
      await bulkTasks(deps, scope, { action: 'move', projectId: 'ev', taskIds: [a.id, b.id] }),
    );
    expect(done.affected).toBe(2);
    expect(rows.get(a.id)).toMatchObject({ projectId: 'ev', due: { date: '2026-11-01' } });
    expect(tagLinks.get(a.id)).toEqual(['x']);
    expect(value(await inboxBadge(deps, scope))).toBe(1);
  });

  it('BR-DEL-006: toplu silme tek grup kimliğiyle; ebeveyniyle giden alt görev hata sayılmaz', async () => {
    const { deps, rows } = setup();
    const p = value(await createTask(deps, scope, { title: 'P' }));
    const sub = value(await createTask(deps, scope, { title: 'Alt', parentTaskId: p.id }));
    const other = value(await createTask(deps, scope, { title: 'O' }));
    const result = value(
      await bulkTasks(deps, scope, { action: 'delete', taskIds: [p.id, sub.id, other.id] }),
    );
    expect(result.batchId).toBeDefined();
    expect(new Set([p.id, sub.id, other.id].map((id) => rows.get(id)?.deletedBatchId))).toEqual(
      new Set([result.batchId]),
    );
  });

  it('D-084: durum, öncelik, tarih ve etiket ekleme/kaldırma', async () => {
    const { deps, rows, tagLinks } = setup();
    const a = value(await createTask(deps, scope, { title: 'A', tagNames: ['iş', 'ev'] }));
    const ids = [a.id];
    value(
      await bulkTasks(deps, scope, { action: 'setStatus', status: 'in_progress', taskIds: ids }),
    );
    value(await bulkTasks(deps, scope, { action: 'setPriority', priority: 2, taskIds: ids }));
    value(
      await bulkTasks(deps, scope, { action: 'setDue', due: { date: '2026-12-01' }, taskIds: ids }),
    );
    value(await bulkTasks(deps, scope, { action: 'removeTags', tagNames: ['İŞ'], taskIds: ids }));
    value(await bulkTasks(deps, scope, { action: 'addTags', tagNames: ['acil'], taskIds: ids }));
    expect(rows.get(a.id)).toMatchObject({
      status: 'in_progress',
      priority: 2,
      due: { date: '2026-12-01' },
    });
    expect(tagLinks.get(a.id)).toEqual(['ev', 'acil']);
    expect(BULK_LIMIT).toBe(200);
  });
});

describe('Faz 6 — tekrarlayan görevler (BR-REC-001..007)', () => {
  it('BR-REC-001: tekrar yalnızca son tarihli üst düzey görevde; geçersiz kural 400', async () => {
    const { deps } = setup();
    expect(
      failure(await createTask(deps, scope, { title: 'X', recurrence: { rule: 'FREQ=DAILY' } })),
    ).toMatchObject({ rule: 'BR-REC-001' });
    expect(
      failure(
        await createTask(deps, scope, {
          title: 'X',
          due: { date: '2026-10-28' },
          recurrence: { rule: 'FREQ=HOURLY' },
        }),
      ),
    ).toMatchObject({ kind: 'validation' });
  });

  it('AC-04 / BR-REC-002 / BR-REC-004: tamamlanınca sonraki örnek; alanlar, etiketler, alt görevler ve göreli hatırlatıcı kopyalanır', async () => {
    const { deps, rows, tagLinks, reminderRows } = setup([EV]);
    const t = value(
      await createTask(deps, scope, {
        title: 'Haftalık rapor',
        projectId: 'ev',
        priority: 2,
        startDate: '2026-11-01',
        due: { date: '2026-11-02', time: '09:30', timezone: 'Europe/Istanbul' },
        tagNames: ['iş'],
        recurrence: { rule: 'FREQ=WEEKLY;BYDAY=MO' },
        reminders: [{ kind: 'relative', offsetMinutes: 30 }],
      }),
    );
    value(await createTask(deps, scope, { title: 'Alt', parentTaskId: t.id }));
    const done = value(await completeTask(deps, scope, t.id, { version: t.version }));
    const next = done.nextOccurrence!;
    expect(next).toMatchObject({
      title: 'Haftalık rapor',
      projectId: 'ev',
      priority: 2,
      status: 'todo',
      startDate: '2026-11-08',
      due: { date: '2026-11-09', time: '09:30', timezone: 'Europe/Istanbul' },
      recurrence: { index: 2, anchor: '2026-11-09', generatedFrom: t.id },
    });
    expect(next.due?.at?.toISOString()).toBe('2026-11-09T06:30:00.000Z');
    expect(tagLinks.get(next.id)).toEqual(['iş']);
    expect([...rows.values()].filter((x) => x.parentTaskId === next.id)).toHaveLength(1);
    const reminders = [...reminderRows.values()];
    expect(reminders.find((r) => r.taskId === t.id)?.status).toBe('canceled');
    expect(reminders.find((r) => r.taskId === next.id)).toMatchObject({
      kind: 'relative',
      offsetMinutes: 30,
      status: 'pending',
    });
  });

  it('BR-REC-007: geri alınınca değiştirilmemiş sonraki örnek silinir; değiştirilmişse korunur ve tekrar üretilmez', async () => {
    const { deps, rows } = setup();
    const t = value(
      await createTask(deps, scope, {
        title: 'Su iç',
        due: { date: '2026-10-28' },
        recurrence: { rule: 'FREQ=DAILY' },
      }),
    );
    const c1 = value(await completeTask(deps, scope, t.id, { version: t.version }));
    const r1 = value(await reopenTask(deps, scope, t.id, { version: c1.version }));
    expect(rows.has(c1.nextOccurrence!.id)).toBe(false);
    expect(r1.keptNextOccurrence).toBe(false);

    const c2 = value(await completeTask(deps, scope, t.id, { version: r1.version }));
    const next = c2.nextOccurrence!;
    value(await updateTask(deps, scope, next.id, { version: next.version, title: 'Su iç (2 L)' }));
    const r2 = value(await reopenTask(deps, scope, t.id, { version: c2.version }));
    expect(r2.keptNextOccurrence).toBe(true);
    expect(rows.has(next.id)).toBe(true);
    const c3 = value(await completeTask(deps, scope, t.id, { version: r2.version }));
    expect(c3.nextOccurrence).toBeNull();
  });

  it('BR-REC-006: tarih değişikliğinde kapsam gerekir; "bu ve sonraki" planlanan tarihi taşır, kural kaldırılınca seri durur', async () => {
    const { deps } = setup();
    const t = value(
      await createTask(deps, scope, {
        title: 'T',
        due: { date: '2026-10-26' },
        recurrence: { rule: 'FREQ=WEEKLY' },
      }),
    );
    expect(
      failure(await updateTask(deps, scope, t.id, { version: 1, due: { date: '2026-10-27' } })),
    ).toMatchObject({ kind: 'validation' });
    const onlyThis = value(
      await updateTask(deps, scope, t.id, {
        version: 1,
        due: { date: '2026-10-27' },
        recurrenceScope: 'this',
      }),
    );
    expect(onlyThis.recurrence?.anchor).toBe('2026-10-26');
    const following = value(
      await updateTask(deps, scope, t.id, {
        version: onlyThis.version,
        due: { date: '2026-10-28' },
        recurrenceScope: 'following',
      }),
    );
    expect(following.recurrence?.anchor).toBe('2026-10-28');
    expect(
      failure(await updateTask(deps, scope, t.id, { version: following.version, due: null })),
    ).toMatchObject({ rule: 'BR-REC-001' });
    const stopped = value(
      await updateTask(deps, scope, t.id, { version: following.version, recurrence: null }),
    );
    expect(stopped.recurrence).toBeNull();
    const done = value(await completeTask(deps, scope, t.id, { version: stopped.version }));
    expect(done.nextOccurrence).toBeNull();
  });

  it('BR-REC-006: "yalnızca bu örneği sil" seriyi sonraki örnekle sürdürür', async () => {
    const { deps, rows } = setup();
    const t = value(
      await createTask(deps, scope, {
        title: 'Spor',
        due: { date: '2026-10-28' },
        recurrence: { rule: 'FREQ=DAILY;INTERVAL=2' },
      }),
    );
    const result = value(
      await deleteTask(deps, scope, t.id, undefined, { recurrenceScope: 'this' }),
    );
    expect(rows.get(result.nextOccurrenceId!)?.due?.date).toBe('2026-10-30');
  });
});

describe('Faz 6 — hatırlatıcılar (BR-REM-001..005)', () => {
  it('BR-REM-001/002: göreli için son tarih gerekir; en fazla 5; geçmiş ve aynı an reddedilir', async () => {
    const { deps } = setup();
    const undated = value(await createTask(deps, scope, { title: 'A' }));
    expect(
      failure(await addReminder(deps, scope, undated.id, { kind: 'relative', offsetMinutes: 10 })),
    ).toMatchObject({ rule: 'BR-REM-001' });
    expect(
      failure(
        await addReminder(deps, scope, undated.id, {
          kind: 'absolute',
          remindAt: '2026-10-28T09:00:30Z',
        }),
      ),
    ).toMatchObject({ rule: 'BR-REM-002' });
    const dated = value(await createTask(deps, scope, { title: 'B', due: { date: '2026-11-05' } }));
    for (const offset of [0, 10, 30, 60, 1440]) {
      value(await addReminder(deps, scope, dated.id, { kind: 'relative', offsetMinutes: offset }));
    }
    expect(
      failure(await addReminder(deps, scope, dated.id, { kind: 'relative', offsetMinutes: 5 })),
    ).toMatchObject({ rule: 'BR-REM-002' });
    const other = value(await createTask(deps, scope, { title: 'C', due: { date: '2026-11-05' } }));
    value(await addReminder(deps, scope, other.id, { kind: 'relative', offsetMinutes: 0 }));
    expect(
      failure(await addReminder(deps, scope, other.id, { kind: 'relative', offsetMinutes: 0 })),
    ).toMatchObject({ rule: 'BR-REM-002' });
  });

  it('BR-REM-001: tüm gün görevde referans, kullanıcının tüm gün saati (09:00 İstanbul)', async () => {
    const { deps } = setup();
    const t = value(await createTask(deps, scope, { title: 'A', due: { date: '2026-11-05' } }));
    const r = value(await addReminder(deps, scope, t.id, { kind: 'relative', offsetMinutes: 60 }));
    expect(r.remindAt.toISOString()).toBe('2026-11-05T05:00:00.000Z');
  });

  it('BR-REM-004: son tarih değişince göreli yeniden hesaplanır, kaldırılınca silinir; mutlak etkilenmez', async () => {
    const { deps, reminderRows } = setup();
    const t = value(await createTask(deps, scope, { title: 'A', due: { date: '2026-11-05' } }));
    value(await addReminder(deps, scope, t.id, { kind: 'relative', offsetMinutes: 0 }));
    value(
      await addReminder(deps, scope, t.id, { kind: 'absolute', remindAt: '2026-11-01T10:00:00Z' }),
    );
    const moved = value(
      await updateTask(deps, scope, t.id, { version: 1, due: { date: '2026-11-06' } }),
    );
    const relative = [...reminderRows.values()].find((r) => r.kind === 'relative')!;
    expect(relative.remindAt.toISOString()).toBe('2026-11-06T06:00:00.000Z');
    value(await updateTask(deps, scope, t.id, { version: moved.version, due: null }));
    expect([...reminderRows.values()].map((r) => r.kind)).toEqual(['absolute']);
  });

  it('BR-REM-003: tamamlanınca, arşivlenince ve çöpe gidince iptal; geri gelince geleceğe ait olan bekler', async () => {
    const { deps, reminderRows } = setup();
    const t = value(await createTask(deps, scope, { title: 'A', due: { date: '2026-11-05' } }));
    value(await addReminder(deps, scope, t.id, { kind: 'relative', offsetMinutes: 0 }));
    const status = () => [...reminderRows.values()][0]!.status;
    const done = value(await completeTask(deps, scope, t.id, { version: 1 }));
    expect(status()).toBe('canceled');
    const back = value(await reopenTask(deps, scope, t.id, { version: done.version }));
    expect(status()).toBe('pending');
    const archived = value(await archiveTask(deps, scope, t.id, { version: back.version }));
    expect(status()).toBe('canceled');
    value(await unarchiveTask(deps, scope, t.id, { version: archived.version }));
    expect(status()).toBe('pending');
    const del = value(await deleteTask(deps, scope, t.id));
    expect(status()).toBe('canceled');
    value(await restoreFromTrash(deps, scope, { batchId: del.batchId }));
    expect(status()).toBe('pending');
  });

  it('BR-REM-005 / BR-NOTIF-002: zamanı gelen hatırlatıcı bir kez gönderilir; geciken işaretlenir, eskisi atlanır', async () => {
    const now = new Date('2026-10-28T09:00:00Z');
    const reminders = [
      { id: 'r1', minutesAgo: 1 },
      { id: 'r2', minutesAgo: 30 },
      { id: 'r3', minutesAgo: 60 * 25 },
      { id: 'r4', minutesAgo: 2 },
    ].map(({ id, minutesAgo }) => ({
      id,
      taskId: id === 'r4' ? 'done-task' : 't1',
      workspaceId: 'w1',
      kind: 'absolute' as const,
      offsetMinutes: null,
      remindAt: new Date(now.getTime() - minutesAgo * 60_000),
      status: 'pending' as 'pending' | 'sent' | 'canceled' | 'skipped',
      sentAt: null,
    }));
    const notified: { late: boolean; reminderId: string }[] = [];
    const deps = {
      clock: fixedClock(now),
      newId: () => 'n',
      enabled: true,
      due: async () => reminders.filter((r) => r.status === 'pending'),
      transition: async (id: string, status: 'sent' | 'canceled' | 'skipped') => {
        const r = reminders.find((x) => x.id === id)!;
        if (r.status !== 'pending') return false;
        r.status = status;
        return true;
      },
      task: async (_w: string, taskId: string) => ({ title: 'X', active: taskId !== 'done-task' }),
      notify: async (n: { late: boolean; reminderId: string }) => {
        notified.push({ late: n.late, reminderId: n.reminderId });
        return true;
      },
    };
    const first = await dispatchDueReminders(deps, 'u1');
    expect(first).toEqual({ sent: 2, skipped: 1, canceled: 1 });
    expect(notified).toEqual([
      { late: false, reminderId: 'r1' },
      { late: true, reminderId: 'r2' },
    ]);
    expect(await dispatchDueReminders(deps, 'u1')).toEqual({ sent: 0, skipped: 0, canceled: 0 });
    expect(notified).toHaveLength(2);
  });
});
