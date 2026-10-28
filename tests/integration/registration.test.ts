import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerUser, type RegistrationStore } from '@/modules/identity/application/register-user';
import { createDrizzleRegistrationStore } from '@/modules/identity/infrastructure/drizzle-registration-store';
import * as schema from '@/shared/db/schema';
import { createSqlClient, type Database } from '@/shared/db/client';
import { fixedClock } from '@/shared/kernel/clock';
import { uuidv7 } from '@/shared/kernel/id';
import { startTestDatabase } from '../fixtures/test-database';

let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let client: ReturnType<typeof createSqlClient>;
let database: Database;

const deps = (store: RegistrationStore) => ({
  store,
  hasher: { hash: async (p: string) => `hash:${p.length}` },
  clock: fixedClock(new Date('2026-10-28T09:00:00Z')),
  newId: () => uuidv7(),
});

const command = {
  name: 'Elif Yılmaz',
  email: 'Elif@Ornek.com',
  password: 'ayisigi gece 2026',
  locale: 'tr' as const,
  timezone: 'Europe/Istanbul',
};

async function counts() {
  const [row] = await client<Record<string, number>[]>`
    select (select count(*)::int from users) as users,
           (select count(*)::int from auth_accounts) as accounts,
           (select count(*)::int from workspaces) as workspaces,
           (select count(*)::int from workspace_memberships) as memberships,
           (select count(*)::int from projects) as projects,
           (select count(*)::int from user_preferences) as prefs`;
  return row;
}

beforeAll(async () => {
  testDb = await startTestDatabase();
  client = createSqlClient(testDb.url, 5);
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

describe('BR-WS-001: kayıtta kişisel çalışma alanı', () => {
  it('BR-WS-001: kayıt tek işlemde kullanıcı, kişisel alan, sahip üyeliği, Inbox ve tercihleri oluşturur', async () => {
    const result = await registerUser(deps(createDrizzleRegistrationStore(database)), command);
    expect(result.ok).toBe(true);
    expect(await counts()).toEqual({
      users: 1,
      accounts: 1,
      workspaces: 1,
      memberships: 1,
      projects: 1,
      prefs: 1,
    });

    const [row] = await client`
      select u.email, w.type, w.name, m.role, p.kind, pr.week_start, pr.date_format, pr.timezone
      from users u join workspaces w on w.owner_user_id = u.id
      join workspace_memberships m on m.workspace_id = w.id
      join projects p on p.workspace_id = w.id join user_preferences pr on pr.user_id = u.id`;
    expect(row).toMatchObject({
      email: 'elif@ornek.com', // BR-ACC-001
      type: 'personal',
      name: 'Kişisel',
      role: 'owner',
      kind: 'inbox', // D-030
      week_start: 1, // BR-PREF-001
      date_format: 'DD.MM.YYYY',
      timezone: 'Europe/Istanbul',
    });
  });

  it('BR-WS-001: işlemin ortasında bir adım başarısız olursa hiçbir kayıt kalmaz (yarım hesap yok)', async () => {
    // Inbox ekleme adımını veritabanı düzeyinde başarısız kılmak için geçici bir tetikleyici.
    await client.unsafe(`
      create or replace function fail_inbox() returns trigger language plpgsql as $$
      begin raise exception 'test: inbox eklenemedi'; end $$;
      create trigger fail_inbox before insert on projects for each row execute function fail_inbox();`);
    try {
      await expect(
        registerUser(deps(createDrizzleRegistrationStore(database)), command),
      ).rejects.toThrow();
      expect(await counts()).toEqual({
        users: 0,
        accounts: 0,
        workspaces: 0,
        memberships: 0,
        projects: 0,
        prefs: 0,
      });
    } finally {
      await client.unsafe('drop trigger fail_inbox on projects; drop function fail_inbox();');
    }
  });

  it('BR-WS-001: veritabanı aynı kullanıcıya ikinci kişisel alanı kabul etmez', async () => {
    await registerUser(deps(createDrizzleRegistrationStore(database)), command);
    const [user] = await client<{ id: string }[]>`select id from users`;
    await expect(
      database.execute(
        sql`insert into workspaces (id, type, name, owner_user_id) values (${uuidv7()}, 'personal', 'İkinci', ${user!.id})`,
      ),
    ).rejects.toThrow();
  });
});

describe('BR-ACC-001: e-posta benzersizliği', () => {
  it('BR-ACC-001: büyük/küçük harf farkıyla aynı e-postaya ikinci hesap açılmaz', async () => {
    const store = createDrizzleRegistrationStore(database);
    await registerUser(deps(store), command);
    const second = await registerUser(deps(store), { ...command, email: 'ELIF@ornek.com' });
    expect(second).toEqual({ ok: false, error: { kind: 'business_rule', rule: 'BR-ACC-001' } });
    expect((await counts())?.users).toBe(1);
  });

  it('BR-ACC-001: aynı anda iki kayıt denemesinde yalnızca biri başarılı olur', async () => {
    const store = createDrizzleRegistrationStore(database);
    const results = await Promise.all([
      registerUser(deps(store), command),
      registerUser(deps(store), command),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await counts())?.users).toBe(1);
  });

  it('BR-ACC-002: geçersiz şifreyle hiçbir kayıt yazılmaz', async () => {
    const result = await registerUser(deps(createDrizzleRegistrationStore(database)), {
      ...command,
      password: 'kisa',
    });
    expect(result.ok).toBe(false);
    expect((await counts())?.users).toBe(0);
  });
});

describe('D-030 / BR-PROJ-006: Inbox korumaları (veritabanı kısıtları)', () => {
  it('BR-PROJ-006: Inbox arşivlenemez ve çöpe atılamaz; ikinci Inbox oluşturulamaz', async () => {
    await registerUser(deps(createDrizzleRegistrationStore(database)), command);
    await expect(
      client`update projects set archived_at = now() where kind = 'inbox'`,
    ).rejects.toThrow();
    await expect(
      client`update projects set deleted_at = now() where kind = 'inbox'`,
    ).rejects.toThrow();
    const [p] = await client<
      { workspace_id: string; created_by: string }[]
    >`select workspace_id, created_by from projects`;
    await expect(
      client`insert into projects (id, workspace_id, kind, name, color, position, created_by)
             values (${uuidv7()}, ${p!.workspace_id}, 'inbox', 'Inbox 2', 'slate', 'a1', ${p!.created_by})`,
    ).rejects.toThrow();
  });
});

describe('BR-ACC-005 temeli: kullanıcı silinince verisi kalmaz', () => {
  it('BR-ACC-005: kullanıcı silindiğinde çalışma alanı, üyelik, Inbox, tercihler ve kimlik kayıtları da silinir', async () => {
    await registerUser(deps(createDrizzleRegistrationStore(database)), command);
    await client`delete from users`;
    expect(await counts()).toEqual({
      users: 0,
      accounts: 0,
      workspaces: 0,
      memberships: 0,
      projects: 0,
      prefs: 0,
    });
  });
});
