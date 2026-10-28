import { drizzle } from 'drizzle-orm/postgres-js';
import { NextResponse } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerUser } from '@/modules/identity/application/register-user';
import { createDrizzleRegistrationStore } from '@/modules/identity/infrastructure/drizzle-registration-store';
import { createTask, completeTask, getTask } from '@/modules/tasks/application/tasks';
import { taskDeps } from '@/modules/tasks/http/task-handlers';
import { resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { createSqlClient, type Database } from '@/shared/db/client';
import * as schema from '@/shared/db/schema';
import type { ApiContext } from '@/shared/http/api-route';
import { idempotent, idempotencyCleanupJob } from '@/shared/http/idempotency';
import { fixedClock } from '@/shared/kernel/clock';
import { uuidv7 } from '@/shared/kernel/id';
import { startTestDatabase } from '../fixtures/test-database';

let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let client: ReturnType<typeof createSqlClient>;
let database: Database;
const clock = fixedClock(new Date('2026-10-28T09:00:00Z'));

async function newUser(email: string): Promise<{ userId: string; scope: WorkspaceScope }> {
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
  const scope = await resolveWorkspaceScope(
    database,
    result.value.userId,
    result.value.workspaceId,
  );
  return { userId: result.value.userId, scope: scope! };
}

const deps = () => ({ ...taskDeps(database), clock });

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

describe('görevler (veritabanı)', () => {
  it('BR-TASK-002: proje verilmeden oluşturulan görev Inbox’a eklenir; tarih alanları doğru saklanır', async () => {
    const { scope } = await newUser('a@ornek.test');
    const created = await createTask(deps(), scope, {
      title: 'Kira',
      due: { date: '2026-11-01', time: '10:00', timezone: 'Europe/Istanbul' },
    });
    if (!created.ok) throw new Error('oluşturulamadı');
    const [row] = await client<
      { kind: string; due_date: string; due_time: string; due_at: string }[]
    >`select p.kind, t.due_date::text, t.due_time::text, t.due_at from tasks t join projects p on p.id = t.project_id`;
    expect(row).toMatchObject({ kind: 'inbox', due_date: '2026-11-01', due_time: '10:00:00' });
    expect(new Date(row!.due_at).toISOString()).toBe('2026-11-01T07:00:00.000Z');
    const read = await getTask(deps(), scope, created.value.id);
    expect(read).toMatchObject({ ok: true, value: { due: { time: '10:00' } } });
  });

  it('BR-PERM-001 / BR-WS-002: başka kullanıcının kapsamıyla görev görülmez ve değiştirilemez', async () => {
    const a = await newUser('a@ornek.test');
    const b = await newUser('b@ornek.test');
    const created = await createTask(deps(), a.scope, { title: 'A’nın görevi' });
    if (!created.ok) throw new Error('oluşturulamadı');
    expect(await getTask(deps(), b.scope, created.value.id)).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    });
    expect(await completeTask(deps(), b.scope, created.value.id, { version: 1 })).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    });
    // B, A’nın çalışma alanının kapsamını üretemez
    expect(await resolveWorkspaceScope(database, b.userId, a.scope.workspaceId)).toBeNull();
  });

  it('BR-WS-002: veritabanı görevin başka çalışma alanındaki projeye bağlanmasını kabul etmez', async () => {
    const a = await newUser('a@ornek.test');
    const b = await newUser('b@ornek.test');
    const [inboxB] = await client<{ id: string }[]>`
      select id from projects where workspace_id = ${b.scope.workspaceId}`;
    await expect(
      client`insert into tasks (id, workspace_id, project_id, title, position)
             values (${uuidv7()}, ${a.scope.workspaceId}, ${inboxB!.id}, 'x', 'a0')`,
    ).rejects.toThrow();
  });

  it('BR-TASK-004: veritabanı tamamlanma tutarsızlığını kabul etmez', async () => {
    const { scope } = await newUser('a@ornek.test');
    const created = await createTask(deps(), scope, { title: 'A' });
    if (!created.ok) throw new Error('oluşturulamadı');
    await expect(
      client`update tasks set status = 'done' where id = ${created.value.id}`,
    ).rejects.toThrow();
  });

  it('BR-TASK-005: öncelik 0–3 dışında olamaz (veritabanı kısıtı)', async () => {
    const { scope } = await newUser('a@ornek.test');
    const created = await createTask(deps(), scope, { title: 'A', priority: 3 });
    if (!created.ok) throw new Error('oluşturulamadı');
    await expect(
      client`update tasks set priority = 4 where id = ${created.value.id}`,
    ).rejects.toThrow();
  });

  it('BR-DEL-007: çöpteki göreve doğrudan erişim bulunamadı döner', async () => {
    const { scope } = await newUser('a@ornek.test');
    const created = await createTask(deps(), scope, { title: 'A' });
    if (!created.ok) throw new Error('oluşturulamadı');
    await client`update tasks set deleted_at = now() where id = ${created.value.id}`;
    expect(await getTask(deps(), scope, created.value.id)).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    });
  });

  it('BR-ACC-005: kullanıcı silinince görevleri de silinir', async () => {
    const { scope } = await newUser('a@ornek.test');
    await createTask(deps(), scope, { title: 'A' });
    await client`delete from users`;
    const [row] = await client<{ n: number }[]>`select count(*)::int as n from tasks`;
    expect(row?.n).toBe(0);
  });
});

describe('BR-TASK-007: idempotency', () => {
  function context(userId: string, key: string | null): ApiContext {
    const headers = new Headers(key ? { 'idempotency-key': key } : {});
    return {
      request: new Request('http://localhost/api/v1/workspaces/w/tasks', {
        method: 'POST',
        headers,
      }),
      requestId: 'req',
      locale: 'tr',
      t: (k: string) => k,
      actor: { userId, sessionId: 's' },
      params: {},
      json: (status, body) => NextResponse.json(body, { status }),
      fail: (error) =>
        NextResponse.json({ error }, { status: error.kind === 'validation' ? 400 : 422 }),
      parse: async () => {
        throw new Error('kullanılmaz');
      },
    };
  }

  async function send(scope: WorkspaceScope, key: string | null, title: string) {
    const response = await idempotent(
      context(scope.userId, key),
      { title },
      async (tx) => {
        const result = await createTask({ ...taskDeps(tx), clock }, scope, { title });
        return result.ok
          ? { status: 201, body: { data: { id: result.value.id } } }
          : { status: 400, body: { error: result.error } };
      },
      database,
    );
    return { status: response.status, body: (await response.json()) as { data?: { id: string } } };
  }

  it('aynı anahtarla iki eşzamanlı istekte tek görev oluşur ve iki yanıt aynı kimliği taşır', async () => {
    const { scope } = await newUser('a@ornek.test');
    const [first, second] = await Promise.all([
      send(scope, 'anahtar-0001', 'Market'),
      send(scope, 'anahtar-0001', 'Market'),
    ]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data?.id).toBe(second.body.data?.id);
    const [row] = await client<{ n: number }[]>`select count(*)::int as n from tasks`;
    expect(row?.n).toBe(1);
  });

  it('aynı anahtar farklı gövdeyle 422; başarısız istek anahtarı tüketmez; anahtar zorunlu', async () => {
    const { scope } = await newUser('a@ornek.test');
    await send(scope, 'anahtar-0002', 'Bir');
    expect((await send(scope, 'anahtar-0002', 'İki')).status).toBe(422);

    expect((await send(scope, 'anahtar-0003', '   ')).status).toBe(400); // başlık geçersiz
    expect((await send(scope, 'anahtar-0003', '   ')).status).toBe(400); // yeniden denenir, kayıt yok
    expect((await send(scope, null, 'x')).status).toBe(400);
  });

  it('D-019: 24 saatten eski kayıtlar temizlenir', async () => {
    const { scope } = await newUser('a@ornek.test');
    await send(scope, 'anahtar-0004', 'Eski');
    await client`update idempotency_keys set created_at = now() - interval '25 hours'`;
    await idempotencyCleanupJob(() => database).run();
    const [row] = await client<{ n: number }[]>`select count(*)::int as n from idempotency_keys`;
    expect(row?.n).toBe(0);
  });
});
