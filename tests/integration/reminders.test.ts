import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerUser } from '@/modules/identity/application/register-user';
import { createDrizzleRegistrationStore } from '@/modules/identity/infrastructure/drizzle-registration-store';
import {
  listNotifications,
  markAllRead,
  markNotification,
} from '@/modules/notifications/application/notifications';
import {
  createNotificationStore,
  purgeOldNotifications,
} from '@/modules/notifications/infrastructure/notification-store';
import { createDrizzlePreferencesStore } from '@/modules/preferences/infrastructure/drizzle-preferences-store';
import { addReminder } from '@/modules/tasks/application/reminders';
import { completeTask, createTask, reopenTask } from '@/modules/tasks/application/tasks';
import { dispatchRemindersFor, taskDeps } from '@/modules/tasks/http/task-handlers';
import { resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { createSqlClient, type Database } from '@/shared/db/client';
import * as schema from '@/shared/db/schema';
import { fixedClock } from '@/shared/kernel/clock';
import { uuidv7 } from '@/shared/kernel/id';
import { startTestDatabase } from '../fixtures/test-database';

let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let client: ReturnType<typeof createSqlClient>;
let database: Database;
const created = new Date('2026-10-29T09:00:00Z');

async function newUser(email: string): Promise<WorkspaceScope> {
  const result = await registerUser(
    {
      store: createDrizzleRegistrationStore(database),
      hasher: { hash: async () => 'hash' },
      clock: fixedClock(created),
      newId: uuidv7,
    },
    { name: 'Test', email, password: 'ayisigi gece 2026', locale: 'tr' },
  );
  if (!result.ok) throw new Error('kayıt başarısız');
  return (await resolveWorkspaceScope(database, result.value.userId, result.value.workspaceId))!;
}

const deps = (now = created) => ({ ...taskDeps(database), clock: fixedClock(now) });
const ok = <T>(r: { ok: boolean; value?: T }) => {
  if (!r.ok) throw new Error(`beklenmeyen hata: ${JSON.stringify(r)}`);
  return r.value as T;
};
const statusOf = async (taskId: string) =>
  (await client<{ status: string }[]>`select status from reminders where task_id = ${taskId}`).map(
    (r) => r.status,
  );

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

describe('hatırlatıcılar ve bildirimler (veritabanı)', () => {
  it('AC-05 / BR-REM-005 / BR-NOTIF-001 / BR-NOTIF-002: paralel iki yoklama tek bildirim üretir', async () => {
    const scope = await newUser('a@ornek.test');
    const task = ok(await createTask(deps(), scope, { title: 'İlaç' }));
    ok(
      await addReminder(deps(), scope, task.id, {
        kind: 'absolute',
        remindAt: '2026-10-29T09:01:00Z',
      }),
    );
    const later = fixedClock(new Date('2026-10-29T09:02:00Z'));
    await Promise.all([
      dispatchRemindersFor(scope.userId, database, later),
      dispatchRemindersFor(scope.userId, database, later),
    ]);
    const list = ok(
      await listNotifications(createNotificationStore(database), scope.userId, {
        unreadOnly: false,
      }),
    );
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      type: 'reminder',
      entityId: task.id,
      payload: { taskId: task.id, title: 'İlaç', late: false },
    });
    expect(await statusOf(task.id)).toEqual(['sent']);
  });

  it('BR-REM-005: 15 dakikadan fazla gecikme "gecikmeli", 24 saatten eskisi atlanır (E18)', async () => {
    const scope = await newUser('b@ornek.test');
    const a = ok(await createTask(deps(), scope, { title: 'Gecikmeli' }));
    const b = ok(await createTask(deps(), scope, { title: 'Eski' }));
    ok(
      await addReminder(deps(), scope, a.id, {
        kind: 'absolute',
        remindAt: '2026-10-30T09:00:00Z',
      }),
    );
    ok(
      await addReminder(deps(), scope, b.id, {
        kind: 'absolute',
        remindAt: '2026-10-29T09:05:00Z',
      }),
    );
    await dispatchRemindersFor(
      scope.userId,
      database,
      fixedClock(new Date('2026-10-30T09:30:00Z')),
    );
    const list = ok(
      await listNotifications(createNotificationStore(database), scope.userId, {
        unreadOnly: false,
      }),
    );
    expect(list.map((n) => [n.payload.title, n.payload.late])).toEqual([['Gecikmeli', true]]);
    expect(await statusOf(b.id)).toEqual(['skipped']);
  });

  it('BR-NOTIF-004: hatırlatıcı bildirimleri kapalıysa zamanı gelen hatırlatıcı atlanır', async () => {
    const scope = await newUser('c@ornek.test');
    const store = createDrizzlePreferencesStore(database);
    const prefs = (await store.find(scope.userId))!;
    await store.update(
      scope.userId,
      prefs.version,
      { notificationSettings: { v: 1, reminder: { inApp: false } } },
      created,
    );
    const task = ok(await createTask(deps(), scope, { title: 'Sessiz' }));
    ok(
      await addReminder(deps(), scope, task.id, {
        kind: 'absolute',
        remindAt: '2026-10-29T09:05:00Z',
      }),
    );
    await dispatchRemindersFor(
      scope.userId,
      database,
      fixedClock(new Date('2026-10-29T09:06:00Z')),
    );
    expect(await statusOf(task.id)).toEqual(['skipped']);
    expect(await createNotificationStore(database).unreadCount(scope.userId)).toBe(0);
  });

  it('BR-NOTIF-003: okundu/okunmadı, tümünü okundu say, başkasının bildirimi bulunamaz, 90 gün sonra silinir', async () => {
    const scope = await newUser('d@ornek.test');
    const other = await newUser('e@ornek.test');
    const store = createNotificationStore(database);
    for (const key of ['k1', 'k2']) {
      await store.create({
        id: uuidv7(),
        userId: scope.userId,
        workspaceId: scope.workspaceId,
        type: 'reminder',
        entityType: 'task',
        entityId: null,
        payload: { taskId: uuidv7(), title: key, remindAt: created.toISOString(), late: false },
        dedupeKey: key,
        now: created,
      });
    }
    const [first] = ok(await listNotifications(store, scope.userId, { unreadOnly: false }));
    expect(await markNotification(store, other.userId, first!.id, true, created)).toMatchObject({
      ok: false,
      error: { kind: 'not_found' },
    });
    ok(await markNotification(store, scope.userId, first!.id, true, created));
    expect(await store.unreadCount(scope.userId)).toBe(1);
    ok(await markNotification(store, scope.userId, first!.id, false, created));
    expect(ok(await markAllRead(store, scope.userId, created))).toEqual({ updated: 2 });
    expect(await store.unreadCount(scope.userId)).toBe(0);
    await client`update notifications set created_at = now() - interval '91 days' where dedupe_key = 'k1'`;
    expect(await purgeOldNotifications(database, new Date(Date.now() - 90 * 86_400_000))).toBe(1);
  });

  it('AC-04 / BR-REC-002 / BR-REC-004 / BR-REC-007: veritabanında sonraki örnek, kopyalanan alanlar ve geri alma', async () => {
    const scope = await newUser('f@ornek.test');
    const task = ok(
      await createTask(deps(), scope, {
        title: 'Haftalık',
        due: { date: '2026-11-02', time: '10:00', timezone: 'America/New_York' },
        tagNames: ['iş'],
        recurrence: { rule: 'FREQ=WEEKLY;BYDAY=MO' },
        reminders: [{ kind: 'relative', offsetMinutes: 60 }],
      }),
    );
    ok(await createTask(deps(), scope, { title: 'Alt', parentTaskId: task.id }));
    const done = ok(
      await database.transaction((tx) =>
        completeTask({ ...taskDeps(tx), clock: fixedClock(created) }, scope, task.id, {
          version: task.version,
        }),
      ),
    );
    const next = done.nextOccurrence!;
    // BR-DATE-006: seri kendi saat diliminde 10:00'da kalır (New York yaz saatinden çıktı: UTC-5).
    expect(next.due).toMatchObject({ date: '2026-11-09', time: '10:00' });
    expect(next.due?.at?.toISOString()).toBe('2026-11-09T15:00:00.000Z');
    const [row] = await client<{ subs: number; tags: number; reminders: number }[]>`
      select
        (select count(*)::int from tasks where parent_task_id = ${next.id}) as subs,
        (select count(*)::int from task_tags where task_id = ${next.id}) as tags,
        (select count(*)::int from reminders where task_id = ${next.id} and status = 'pending') as reminders`;
    expect(row).toEqual({ subs: 1, tags: 1, reminders: 1 });

    const reopened = ok(
      await database.transaction((tx) =>
        reopenTask({ ...taskDeps(tx), clock: fixedClock(created) }, scope, task.id, {
          version: done.version,
        }),
      ),
    );
    expect(reopened.keptNextOccurrence).toBe(false);
    const [{ n } = { n: -1 }] = await client<{ n: number }[]>`
      select count(*)::int as n from tasks where id = ${next.id}`;
    expect(n).toBe(0);
  });
});
