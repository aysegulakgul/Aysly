import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { goalDeps } from '@/modules/goals';
import { createGoal, getGoal, setGoalLinks, updateGoal } from '@/modules/goals/application/goals';
import { registerUser } from '@/modules/identity/application/register-user';
import { createDrizzleRegistrationStore } from '@/modules/identity/infrastructure/drizzle-registration-store';
import { noteDeps } from '@/modules/notes';
import {
  createNote,
  deleteNote,
  listNotes,
  setNoteLinks,
  updateNote,
} from '@/modules/notes/application/notes';
import { createProject } from '@/modules/projects/application/projects';
import { projectDeps } from '@/modules/projects/http/project-handlers';
import { createSqlSearchIndex } from '@/modules/search';
import { searchEverything } from '@/modules/search/application/search';
import { deleteTask } from '@/modules/tasks/application/lifecycle';
import { completeTask, createTask } from '@/modules/tasks/application/tasks';
import { taskDeps } from '@/modules/tasks/http/task-handlers';
import { resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { createSqlClient, type Database } from '@/shared/db/client';
import * as schema from '@/shared/db/schema';
import { fixedClock } from '@/shared/kernel/clock';
import { uuidv7 } from '@/shared/kernel/id';
import { startTestDatabase } from '../fixtures/test-database';

let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let client: ReturnType<typeof createSqlClient>;
let database: Database;
const clock = fixedClock(new Date('2026-10-30T09:00:00Z'));

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

const ok = <T>(r: { ok: boolean; value?: T }) => {
  if (!r.ok) throw new Error(`beklenmeyen hata: ${JSON.stringify(r)}`);
  return r.value as T;
};
const tasks = () => ({ ...taskDeps(database), clock });
const notes = () => ({ ...noteDeps(database), clock });
const goals = () => ({ ...goalDeps(database), clock });
const search = (scope: WorkspaceScope, q: string, includeArchived = false) =>
  searchEverything(createSqlSearchIndex(database), scope, { q, includeArchived });

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

describe('arama, notlar ve hedefler (veritabanı)', () => {
  it('AC-10 / FR-SRCH-02 / BR-SRCH-001: "isik" "Işık faturası"nı bulur; çöpteki görev ve başka kullanıcınınki çıkmaz', async () => {
    const scope = await newUser('a@ornek.test');
    const other = await newUser('b@ornek.test');
    const task = ok(await createTask(tasks(), scope, { title: 'Işık faturası' }));
    ok(await createTask(tasks(), other, { title: 'Işık faturası' }));
    ok(await createNote(notes(), scope, { title: 'Çağrı notları', body: 'Şebeke ölçümü' }));
    ok(await createTask(tasks(), scope, { title: 'Market', tagNames: ['Öğle'] }));

    const hits = ok(await search(scope, 'isik'));
    expect(hits).toEqual([expect.objectContaining({ type: 'task', id: task.id })]);
    expect(ok(await search(scope, 'sebeke olc')).map((h) => h.type)).toEqual(['note']);
    // BR-SRCH-001: etiket adı da eşleşir.
    expect(ok(await search(scope, 'ogle')).map((h) => h.type)).toEqual(['task']);
    expect(await search(scope, 'a')).toMatchObject({ ok: false, error: { kind: 'validation' } });

    ok(await deleteTask(tasks(), scope, task.id));
    expect(ok(await search(scope, 'isik'))).toEqual([]);
  });

  it('BR-GOAL-002: otomatik ilerleme bağlı görevler ∪ bağlı projenin üst düzey görevleri, tekrar saymadan; manuel değer korunur', async () => {
    const scope = await newUser('c@ornek.test');
    const project = ok(
      await createProject({ ...projectDeps(database), clock }, scope, { name: 'Web' }),
    );
    const a = ok(await createTask(tasks(), scope, { title: 'A', projectId: project.id }));
    ok(await createTask(tasks(), scope, { title: 'B', projectId: project.id }));
    const c = ok(await createTask(tasks(), scope, { title: 'C' }));
    ok(await createTask(tasks(), scope, { title: 'Alt', parentTaskId: a.id }));
    ok(await completeTask(tasks(), scope, a.id, { version: a.version }));
    const goal = ok(await createGoal(goals(), scope, { title: 'Yayına hazırla' }));
    expect(ok(await getGoal(goals(), scope, goal.id)).progress).toMatchObject({ percent: null });

    ok(
      await setGoalLinks(goals(), scope, goal.id, {
        taskIds: [a.id, c.id],
        projectIds: [project.id],
      }),
    );
    expect(ok(await getGoal(goals(), scope, goal.id)).progress).toEqual({
      mode: 'auto',
      done: 1,
      total: 3,
      percent: 33,
    });

    const manual = ok(
      await updateGoal(goals(), scope, goal.id, {
        version: goal.version,
        progressMode: 'manual',
        manualProgress: 70,
      }),
    );
    const back = ok(
      await updateGoal(goals(), scope, goal.id, { version: manual.version, progressMode: 'auto' }),
    );
    expect(back.manualProgress).toBe(70);
    // BR-GOAL-004: çöpteki bağlı görev hesaptan çıkar.
    ok(await deleteTask(tasks(), scope, c.id));
    expect(ok(await getGoal(goals(), scope, goal.id)).progress).toMatchObject({
      done: 1,
      total: 2,
    });
  });

  it('BR-NOTE-002: sürüm çakışmasında kullanıcının içeriği çatışma kopyası olarak kaydedilir; BR-NOTE-004 boş not silinir', async () => {
    const scope = await newUser('d@ornek.test');
    const note = ok(await createNote(notes(), scope, { title: 'Plan', body: 'ilk' }));
    const saved = ok(
      await updateNote(notes(), scope, note.id, {
        version: note.version,
        body: 'ikinci',
        conflictLabel: 'çatışma kopyası – 30.10.2026 12:00',
        fallbackTitle: '',
      }),
    );
    expect(saved.kind).toBe('saved');
    const conflict = ok(
      await updateNote(notes(), scope, note.id, {
        version: note.version,
        body: 'başka cihaz',
        conflictLabel: 'çatışma kopyası – 30.10.2026 12:00',
        fallbackTitle: '',
      }),
    );
    expect(conflict).toMatchObject({
      kind: 'conflict_copy',
      note: { title: 'Plan (çatışma kopyası – 30.10.2026 12:00)', body: 'başka cihaz' },
    });
    const list = ok(await listNotes(notes(), scope, {}));
    expect(list).toHaveLength(2);

    const current = list.find((n) => n.id === note.id)!;
    const emptied = ok(
      await updateNote(notes(), scope, note.id, {
        version: current.version,
        title: '',
        body: '',
        conflictLabel: '',
        fallbackTitle: '',
      }),
    );
    expect(emptied.kind).toBe('deleted');
  });

  it('BR-NOTE-003: not görev ve projeye bağlanır; başka alanın kaydına bağlanamaz; not çöpe gidince bağlantılı listeden kalkar', async () => {
    const scope = await newUser('e@ornek.test');
    const other = await newUser('f@ornek.test');
    const task = ok(await createTask(tasks(), scope, { title: 'Ana sayfa' }));
    const foreign = ok(await createTask(tasks(), other, { title: 'Yabancı' }));
    const note = ok(await createNote(notes(), scope, { body: 'Toplantı' }));
    expect(
      await setNoteLinks(notes(), scope, note.id, { taskIds: [foreign.id], projectIds: [] }),
    ).toMatchObject({ ok: false, error: { kind: 'not_found' } });
    ok(await setNoteLinks(notes(), scope, note.id, { taskIds: [task.id], projectIds: [] }));
    expect(ok(await listNotes(notes(), scope, { linkedTaskId: task.id }))).toHaveLength(1);
    ok(await deleteNote(notes(), scope, note.id));
    expect(ok(await listNotes(notes(), scope, { linkedTaskId: task.id }))).toHaveLength(0);
  });
});
