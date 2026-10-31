import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createContact, deleteContact } from '@/modules/contacts/application/contacts';
import { createContactStore } from '@/modules/contacts/infrastructure/contact-store';
import { registerUser } from '@/modules/identity/application/register-user';
import { createDrizzleRegistrationStore } from '@/modules/identity/infrastructure/drizzle-registration-store';
import { addComment, deleteComment, listComments } from '@/modules/tasks/application/comments';
import { listSummaries } from '@/modules/tasks/application/organize';
import { completeTask, createTask, updateTask } from '@/modules/tasks/application/tasks';
import { createCommentStore } from '@/modules/tasks/infrastructure/comment-store';
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
const clock = fixedClock(new Date('2026-10-31T09:00:00Z'));

async function newUser(email: string): Promise<WorkspaceScope> {
  const result = await registerUser(
    {
      store: createDrizzleRegistrationStore(database),
      hasher: { hash: async () => 'hash' },
      clock,
      newId: uuidv7,
    },
    { name: 'Test Kullanıcı', email, password: 'ayisigi gece 2026', locale: 'tr' },
  );
  if (!result.ok) throw new Error('kayıt başarısız');
  return (await resolveWorkspaceScope(database, result.value.userId, result.value.workspaceId))!;
}

const ok = <T>(r: { ok: boolean; value?: T }) => {
  if (!r.ok) throw new Error(`beklenmeyen hata: ${JSON.stringify(r)}`);
  return r.value as T;
};
const tasks = () => ({ ...taskDeps(database), clock });
const contacts = () => ({ contacts: createContactStore(database), clock, newId: uuidv7 });
const comments = () => ({
  tasks: taskDeps(database).tasks,
  comments: createCommentStore(database),
  clock,
  newId: uuidv7,
});

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

describe('kişiler, atama, story point ve yorumlar (veritabanı)', () => {
  it('BR-CONTACT-001: ad zorunlu, e-posta biçimi denetlenir ve küçük harfe çevrilir', async () => {
    const me = await newUser('ben@ornek.test');
    expect(await createContact(contacts(), me, { name: '  ' })).toMatchObject({
      ok: false,
      error: { kind: 'validation' },
    });
    expect(await createContact(contacts(), me, { name: 'Elif', email: 'yanlis' })).toMatchObject({
      ok: false,
    });
    expect(
      ok(await createContact(contacts(), me, { name: ' Elif  Yılmaz ', email: 'Elif@Ornek.TEST' })),
    ).toMatchObject({ name: 'Elif Yılmaz', email: 'elif@ornek.test', color: 'blue' });
  });

  it('BR-TASK-011: kişi atanır ve özette görünür; başka alanın kişisi atanamaz; kişi silinince atama boşalır', async () => {
    const me = await newUser('ben@ornek.test');
    const other = await newUser('baskasi@ornek.test');
    const elif = ok(await createContact(contacts(), me, { name: 'Elif Yılmaz', color: 'pink' }));
    const stranger = ok(await createContact(contacts(), other, { name: 'Yabancı' }));

    const task = ok(
      await createTask(tasks(), me, { title: 'Fatura', assigneeId: elif.id, storyPoints: 8 }),
    );
    const [summary] = await listSummaries(tasks(), me, [task]);
    expect(summary).toMatchObject({
      task: { storyPoints: 8, assigneeId: elif.id },
      assignee: { id: elif.id, name: 'Elif Yılmaz', color: 'pink' },
    });

    expect(
      await updateTask(tasks(), me, task.id, { version: task.version, assigneeId: stranger.id }),
    ).toMatchObject({ ok: false, error: { kind: 'validation' } });
    expect(
      await updateTask(tasks(), me, task.id, { version: task.version, storyPoints: 101 }),
    ).toMatchObject({ ok: false, error: { kind: 'validation' } });

    ok(await deleteContact(contacts(), me, elif.id));
    const [after] = await client`select assignee_contact_id from tasks where id = ${task.id}`;
    expect(after?.assignee_contact_id).toBeNull();
  });

  it('BR-TASK-011: tekrarlayan görevin yeni örneği puanı ve atamayı devralır', async () => {
    const me = await newUser('ben@ornek.test');
    const can = ok(await createContact(contacts(), me, { name: 'Can' }));
    const task = ok(
      await createTask(tasks(), me, {
        title: 'Haftalık rapor',
        due: { date: '2026-11-02' },
        recurrence: { rule: 'FREQ=WEEKLY', mode: 'fixed_schedule' },
        assigneeId: can.id,
        storyPoints: 3,
      }),
    );
    ok(await completeTask(tasks(), me, task.id, { version: task.version }));
    const rows = await client`
      select story_points, assignee_contact_id from tasks where status = 'todo' and title = 'Haftalık rapor'`;
    expect(rows).toEqual([{ story_points: 3, assignee_contact_id: can.id }]);
  });

  it('BR-COMMENT-001: yorum eklenir ve listelenir; boş yorum reddedilir; yalnızca yazan siler', async () => {
    const me = await newUser('ben@ornek.test');
    const other = await newUser('baskasi@ornek.test');
    const task = ok(await createTask(tasks(), me, { title: 'Tasarım' }));

    expect(await addComment(comments(), me, task.id, { body: '   ' })).toMatchObject({ ok: false });
    const first = ok(await addComment(comments(), me, task.id, { body: ' İlk yorum ' }));
    expect(first).toMatchObject({ body: 'İlk yorum', authorName: 'Test Kullanıcı' });
    expect(ok(await listComments(comments(), me, task.id)).map((c) => c.body)).toEqual([
      'İlk yorum',
    ]);

    // Başka kullanıcı görevi göremez (BR-PERM-001) ve yorumu silemez.
    expect(await listComments(comments(), other, task.id)).toMatchObject({
      ok: false,
      error: { kind: 'not_found' },
    });
    expect(await deleteComment(comments(), other, task.id, first.id)).toMatchObject({ ok: false });
    ok(await deleteComment(comments(), me, task.id, first.id));
    expect(ok(await listComments(comments(), me, task.id))).toEqual([]);
  });
});
