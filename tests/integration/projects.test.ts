import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerUser } from '@/modules/identity/application/register-user';
import { createDrizzleRegistrationStore } from '@/modules/identity/infrastructure/drizzle-registration-store';
import { createProject } from '@/modules/projects/application/projects';
import { projectDeps } from '@/modules/projects/http/project-handlers';
import {
  listExpiredTrashedProjects,
  purgeExpiredProjects,
} from '@/modules/projects/infrastructure/drizzle-project-repository';
import { deleteTag, updateTag } from '@/modules/tags/application/tags';
import { createTask } from '@/modules/tasks/application/tasks';
import { bulkTasks } from '@/modules/tasks/application/bulk';
import { listTrash, restoreFromTrash, deleteTask } from '@/modules/tasks/application/lifecycle';
import { deleteProject, projectOverview } from '@/modules/tasks/application/projects';
import { taskDeps } from '@/modules/tasks/http/task-handlers';
import {
  purgeExpiredTasks,
  reassignTrashedTasks,
} from '@/modules/tasks/infrastructure/drizzle-task-repository';
import { createView } from '@/modules/views/application/views';
import { EMPTY_FILTER } from '@/modules/views/domain/task-filter';
import { viewDeps } from '@/modules/views/http/view-handlers';
import { resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import {
  deleteTagRow,
  findTag,
  findTagByName,
  listTagsWithUsage,
  updateTagRow,
} from '@/modules/tags/infrastructure/tag-store';
import { createSqlClient, type Database } from '@/shared/db/client';
import * as schema from '@/shared/db/schema';
import { fixedClock } from '@/shared/kernel/clock';
import { uuidv7 } from '@/shared/kernel/id';
import { startTestDatabase } from '../fixtures/test-database';

let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let client: ReturnType<typeof createSqlClient>;
let database: Database;
const clock = fixedClock(new Date('2026-10-29T09:00:00Z'));

async function newUser(email: string): Promise<WorkspaceScope> {
  const result = await registerUser(
    {
      store: createDrizzleRegistrationStore(database),
      hasher: { hash: async () => 'hash' },
      clock,
      newId: uuidv7,
    },
    { name: 'Test', email, password: 'ayisigi gece 2026', locale: 'tr' },
  );
  if (!result.ok) throw new Error('kayıt başarısız');
  return (await resolveWorkspaceScope(database, result.value.userId, result.value.workspaceId))!;
}

const deps = () => ({ ...taskDeps(database), clock });
const ok = <T>(r: { ok: boolean; value?: T }) => {
  if (!r.ok) throw new Error(`beklenmeyen hata: ${JSON.stringify(r)}`);
  return r.value as T;
};

async function project(scope: WorkspaceScope, name: string) {
  return ok(await createProject({ ...projectDeps(database), clock }, scope, { name }));
}

beforeAll(async () => {
  testDb = await startTestDatabase();
  client = createSqlClient(testDb.url, 10);
  database = drizzle(client, { schema });
});

beforeEach(async () => {
  await client`truncate users cascade`;
});

afterAll(async () => {
  await client?.end({ timeout: 5 });
  await testDb?.stop();
});

describe('projeler ve görünümler (veritabanı)', () => {
  it('AC-06 / BR-PROJ-005: 5 görevli proje tek grupla çöpe gider ve birlikte geri yüklenir', async () => {
    const scope = await newUser('a@ornek.test');
    const ev = await project(scope, 'Ev');
    for (const title of ['1', '2', '3', '4', '5']) {
      ok(await createTask(deps(), scope, { title, projectId: ev.id }));
    }
    const deleted = ok(
      await database.transaction((tx) => deleteProject({ ...taskDeps(tx), clock }, scope, ev.id)),
    );
    expect(deleted.affected.tasks).toBe(5);
    const [row] = await client<{ batches: number }[]>`
      select count(distinct deleted_batch_id)::int as batches from tasks where deleted_at is not null`;
    expect(row!.batches).toBe(1);
    expect(ok(await projectOverview(deps(), scope, {}))).toHaveLength(0);
    const groups = ok(await listTrash(deps(), scope));
    expect(groups).toEqual([
      expect.objectContaining({ root: { type: 'project', id: ev.id, title: 'Ev' }, count: 5 }),
    ]);
    ok(
      await database.transaction((tx) =>
        restoreFromTrash({ ...taskDeps(tx), clock }, scope, { batchId: deleted.batchId }),
      ),
    );
    const [restored] = ok(await projectOverview(deps(), scope, {}));
    expect(restored?.progress).toEqual({ done: 0, total: 5 });
  });

  it('BR-DEL-003 / BR-DEL-004: süresi dolan proje silinirken başka gruptaki görevi Inbox’a bağlanır', async () => {
    const scope = await newUser('b@ornek.test');
    const ev = await project(scope, 'Ev');
    const early = ok(await createTask(deps(), scope, { title: 'Önce', projectId: ev.id }));
    ok(await deleteTask(deps(), scope, early.id));
    ok(await deleteProject(deps(), scope, ev.id));
    // Proje grubunun süresi dolmuş gibi: yalnızca projenin silinme anı geriye çekilir.
    await client`update projects set deleted_at = now() - interval '31 days' where id = ${ev.id}`;
    const before = new Date(Date.now() - 30 * 86_400_000);
    await database.transaction(async (tx) => {
      await reassignTrashedTasks(tx, await listExpiredTrashedProjects(tx, before));
      await purgeExpiredTasks(tx, before);
      await purgeExpiredProjects(tx, before);
    });
    const [task] = await client<{ kind: string; deleted: boolean }[]>`
      select p.kind, t.deleted_at is not null as deleted from tasks t join projects p on p.id = t.project_id
      where t.id = ${early.id}`;
    expect(task).toEqual({ kind: 'inbox', deleted: true });
    const [{ n } = { n: -1 }] = await client<
      { n: number }[]
    >`select count(*)::int as n from projects where id = ${ev.id}`;
    expect(n).toBe(0);
  });

  it('BR-TASK-008: toplu işlem atomiktir — bir görev reddedilince işlem geri alınır, hiçbiri değişmez', async () => {
    const scope = await newUser('c@ornek.test');
    const other = await newUser('d@ornek.test');
    const mine = ok(await createTask(deps(), scope, { title: 'Benim' }));
    const theirs = ok(await createTask(deps(), other, { title: 'Başkasının' }));
    class Rollback extends Error {}
    const failures = await database
      .transaction(async (tx) => {
        const result = await bulkTasks({ ...taskDeps(tx), clock }, scope, {
          action: 'complete',
          taskIds: [mine.id, theirs.id],
        });
        if (!result.ok) throw Object.assign(new Rollback(), { result });
        return result;
      })
      .catch((e: Rollback & { result: unknown }) => e.result);
    expect(failures).toMatchObject({
      ok: false,
      error: { kind: 'bulk_rejected', failures: [{ id: theirs.id, code: 'NOT_FOUND' }] },
    });
    const [row] = await client<
      { status: string }[]
    >`select status from tasks where id = ${mine.id}`;
    expect(row!.status).toBe('todo');
  });

  it('BR-TAG-002: etiket silme kalıcıdır; görevler kalır, bağlantılar kalkar; BR-TAG-001 ad çakışması', async () => {
    const scope = await newUser('e@ornek.test');
    const task = ok(await createTask(deps(), scope, { title: 'Etiketli', tagNames: ['İş', 'ev'] }));
    const tagDeps = {
      tags: {
        list: (s: WorkspaceScope) => listTagsWithUsage(database, s),
        find: (s: WorkspaceScope, id: string) => findTag(database, s, id),
        nameTakenBy: (s: WorkspaceScope, name: string, except: string) =>
          findTagByName(database, s, name, except),
        update: (
          s: WorkspaceScope,
          id: string,
          c: { name?: string | undefined; color?: string | undefined },
          now: Date,
        ) => updateTagRow(database, s, id, c, now),
        remove: (s: WorkspaceScope, id: string) => deleteTagRow(database, s, id),
      },
      clock,
    };
    const tags = await listTagsWithUsage(database, scope);
    const is = tags.find((t) => t.name === 'İş')!;
    const ev = tags.find((t) => t.name === 'ev')!;
    expect(is.tasks).toBe(1);
    expect(await updateTag(tagDeps, scope, ev.id, { name: 'IS' })).toMatchObject({
      ok: false,
      error: { rule: 'BR-TAG-001' },
    });
    expect(ok(await deleteTag(tagDeps, scope, is.id))).toEqual({ removedFrom: { tasks: 1 } });
    const [{ n } = { n: -1 }] = await client<{ n: number }[]>`
      select count(*)::int as n from task_tags where task_id = ${task.id}`;
    expect(n).toBe(1);
    const [{ alive } = { alive: -1 }] = await client<{ alive: number }[]>`
      select count(*)::int as alive from tasks where id = ${task.id} and deleted_at is null`;
    expect(alive).toBe(1);
  });

  it('BR-VIEW-001: kayıtlı görünüm kişiseldir; kullanıcı başına en fazla 50', async () => {
    const scope = await newUser('f@ornek.test');
    const other = await newUser('g@ornek.test');
    const vd = { ...viewDeps(database), clock };
    const view = ok(
      await createView(vd, scope, {
        name: 'Bu hafta – yüksek',
        viewType: 'list',
        filter: { ...EMPTY_FILTER, priority: [3], due: 'next7' },
        sort: 'due',
        groupBy: 'none',
      }),
    );
    expect(await vd.views.find(other, view.id)).toBeNull();
    expect((await vd.views.find(scope, view.id))?.filter).toMatchObject({
      priority: [3],
      due: 'next7',
    });
    for (let i = 1; i < 50; i++) {
      ok(
        await createView(vd, scope, {
          name: `G${i}`,
          viewType: 'board',
          filter: EMPTY_FILTER,
          sort: 'manual',
          groupBy: 'none',
        }),
      );
    }
    expect(
      await createView(vd, scope, {
        name: 'Fazla',
        viewType: 'list',
        filter: EMPTY_FILTER,
        sort: 'manual',
        groupBy: 'none',
      }),
    ).toMatchObject({ ok: false, error: { rule: 'BR-VIEW-001' } });
  });
});
