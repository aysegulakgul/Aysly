import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { exportAccount } from '@/modules/data-portability/application/export';
import { createSqlExportReader } from '@/modules/data-portability/infrastructure/sql-export-reader';
import {
  cancelAccountDeletion,
  purgeDueAccounts,
  requestAccountDeletion,
} from '@/modules/identity/application/account-deletion';
import { registerUser } from '@/modules/identity/application/register-user';
import { createDrizzleDeletionStore } from '@/modules/identity/infrastructure/drizzle-deletion-store';
import { createDrizzleRegistrationStore } from '@/modules/identity/infrastructure/drizzle-registration-store';
import { noteDeps } from '@/modules/notes';
import { createNote } from '@/modules/notes/application/notes';
import { deleteTask } from '@/modules/tasks/application/lifecycle';
import { createTask } from '@/modules/tasks/application/tasks';
import { taskDeps } from '@/modules/tasks/http/task-handlers';
import { resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { createSqlClient, type Database } from '@/shared/db/client';
import * as schema from '@/shared/db/schema';
import { fixedClock, type Clock } from '@/shared/kernel/clock';
import { uuidv7 } from '@/shared/kernel/id';
import { startTestDatabase } from '../fixtures/test-database';

let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let client: ReturnType<typeof createSqlClient>;
let database: Database;
const start = new Date('2026-10-30T09:00:00Z');
const clock = fixedClock(start);
const DAY = 24 * 60 * 60 * 1000;

async function newUser(email: string): Promise<WorkspaceScope> {
  const result = await registerUser(
    {
      store: createDrizzleRegistrationStore(database),
      hasher: { hash: async () => 'gizli-hash-degeri' },
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
const deletion = (at: Clock = clock) => ({
  store: createDrizzleDeletionStore(database),
  clock: at,
  verifyPassword: async (password: string) => password === 'dogru sifre',
});

/** Kullanıcıya bağlı satırlar: kişisel alanın içeriği ve kullanıcı kimliği taşıyan tüm tablolar. */
async function rowsOf(userId: string, workspaceId: string) {
  const [row] = await client<{ total: number }[]>`
    select
      (select count(*) from users where id = ${userId})
      + (select count(*) from auth_sessions where user_id = ${userId})
      + (select count(*) from auth_accounts where user_id = ${userId})
      + (select count(*) from user_preferences where user_id = ${userId})
      + (select count(*) from workspace_memberships where user_id = ${userId})
      + (select count(*) from workspaces where id = ${workspaceId})
      + (select count(*) from projects where workspace_id = ${workspaceId})
      + (select count(*) from tasks where workspace_id = ${workspaceId})
      + (select count(*) from notes where workspace_id = ${workspaceId})
      + (select count(*) from notifications where user_id = ${userId})
      + (select count(*) from idempotency_keys where user_id = ${userId})
      + (select count(*) from audit_events where actor_user_id = ${userId})
      as total`;
  return Number(row?.total);
}

beforeAll(async () => {
  testDb = await startTestDatabase();
  client = createSqlClient(testDb.url, 10);
  database = drizzle(client, { schema });
});

beforeEach(async () => {
  await client`truncate users cascade`;
  await client`truncate audit_events`;
});

afterAll(async () => {
  await client?.end({ timeout: 5 });
  await testDb?.stop();
});

describe('dışa aktarma ve hesap silme (veritabanı)', () => {
  it('D-059: dışa aktarma içeriği, çöp kutusunu ve tercihleri içerir; güvenlik bilgisi ve başka kullanıcı yoktur', async () => {
    const me = await newUser('ben@ornek.test');
    const other = await newUser('baskasi@ornek.test');
    ok(await createTask(tasks(), me, { title: 'Fatura öde' }));
    const trashed = ok(await createTask(tasks(), me, { title: 'Çöpteki görev' }));
    ok(await deleteTask(tasks(), me, trashed.id));
    ok(
      await createNote({ ...noteDeps(database), clock }, me, { title: 'Fikir', body: '**kalın**' }),
    );
    ok(await createTask(tasks(), other, { title: 'Başkasının görevi' }));

    const doc = ok(
      await exportAccount(
        { reader: createSqlExportReader(database), clock, verifyPassword: async () => true },
        { userId: me.userId, workspaceId: me.workspaceId },
        { currentPassword: 'x' },
      ),
    );
    expect(doc).toMatchObject({
      format: 'aysly-export',
      version: 1,
      profile: { email: 'ben@ornek.test' },
    });
    const titles = doc.content.tasks!.map((t) => t.title);
    expect(titles).toEqual(expect.arrayContaining(['Fatura öde', 'Çöpteki görev']));
    expect(titles).not.toContain('Başkasının görevi');
    expect(doc.content.notes!.map((n) => n.body)).toEqual(['**kalın**']);
    expect(doc.preferences).toMatchObject({ locale: 'tr' });

    const text = JSON.stringify(doc);
    for (const secret of ['gizli-hash-degeri', 'search_vector', 'baskasi@ornek.test', 'token']) {
      expect(text).not.toContain(secret);
    }
  });

  it('D-055: yanlış şifreyle dışa aktarma ve silme talebi reddedilir', async () => {
    const me = await newUser('ben@ornek.test');
    const reader = createSqlExportReader(database);
    expect(
      await exportAccount(
        { reader, clock, verifyPassword: async () => false },
        { userId: me.userId, workspaceId: me.workspaceId },
        { currentPassword: 'yanlis' },
      ),
    ).toMatchObject({ ok: false, error: { kind: 'validation' } });
    expect(
      await requestAccountDeletion(deletion(), me, { currentPassword: 'yanlis' }),
    ).toMatchObject({ ok: false });
    const [user] = await client`select deletion_requested_at from users where id = ${me.userId}`;
    expect(user?.deletion_requested_at).toBeNull();
  });

  it('BR-ACC-005: talep oturumları kapatır; 14 gün dolmadan silinmez, iptal edilen talep silinmez', async () => {
    const me = await newUser('ben@ornek.test');
    await client`insert into auth_sessions (id, user_id, token, expires_at, created_at, updated_at)
      values (${uuidv7()}, ${me.userId}, 'oturum', ${new Date(start.getTime() + DAY).toISOString()}, ${start.toISOString()}, ${start.toISOString()})`;

    const requested = ok(
      await requestAccountDeletion(deletion(), me, { currentPassword: 'dogru sifre' }),
    );
    expect(requested.scheduledFor.toISOString()).toBe('2026-11-13T09:00:00.000Z');
    const [sessions] =
      await client`select count(*)::int as n from auth_sessions where user_id = ${me.userId}`;
    expect(sessions?.n).toBe(0);

    expect(await purgeDueAccounts(deletion(fixedClock(new Date(start.getTime() + 13 * DAY))))).toBe(
      0,
    );
    await cancelAccountDeletion(deletion(), me);
    expect(await purgeDueAccounts(deletion(fixedClock(new Date(start.getTime() + 15 * DAY))))).toBe(
      0,
    );
    expect(await rowsOf(me.userId, me.workspaceId)).toBeGreaterThan(0);
  });

  it('BR-ACC-005: 14 gün dolunca kullanıcının hiçbir kaydı kalmaz; denetimde yalnızca anonim olay; iş idempotent', async () => {
    const me = await newUser('ben@ornek.test');
    const other = await newUser('baskasi@ornek.test');
    ok(await createTask(tasks(), me, { title: 'Silinecek' }));
    ok(
      await createNote({ ...noteDeps(database), clock }, me, { title: 'Silinecek not', body: '' }),
    );
    ok(await createTask(tasks(), other, { title: 'Kalacak' }));
    await client`insert into audit_events (id, actor_user_id, action, created_at)
      values (${uuidv7()}, ${me.userId}, 'auth.sign_in', ${start.toISOString()})`;

    ok(await requestAccountDeletion(deletion(), me, { currentPassword: 'dogru sifre' }));
    const later = deletion(fixedClock(new Date(start.getTime() + 14 * DAY + 1000)));
    expect(await purgeDueAccounts(later)).toBe(1);
    expect(await purgeDueAccounts(later)).toBe(0);

    expect(await rowsOf(me.userId, me.workspaceId)).toBe(0);
    expect(await rowsOf(other.userId, other.workspaceId)).toBeGreaterThan(0);
    // Diğer kullanıcının olayları durur; silinen kullanıcıdan yalnızca kimliksiz olay kalır.
    const events = await client`select action from audit_events where actor_user_id is null`;
    expect(events.map((e) => e.action)).toEqual(['account.deleted']);
  });
});
