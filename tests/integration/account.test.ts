import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  listSessions,
  revokeOtherSessions,
  revokeSession,
} from '@/modules/identity/application/account';
import { registerUser } from '@/modules/identity/application/register-user';
import { createDrizzleAccountStore } from '@/modules/identity/infrastructure/drizzle-account-store';
import { createDrizzleRegistrationStore } from '@/modules/identity/infrastructure/drizzle-registration-store';
import { createSqlClient, type Database } from '@/shared/db/client';
import * as schema from '@/shared/db/schema';
import { fixedClock } from '@/shared/kernel/clock';
import { uuidv7 } from '@/shared/kernel/id';
import { startTestDatabase } from '../fixtures/test-database';

let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let client: ReturnType<typeof createSqlClient>;
let database: Database;
const clock = fixedClock(new Date('2026-10-28T09:00:00Z'));

async function newUser(email: string): Promise<string> {
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
  return result.value.userId;
}

async function newSession(userId: string, expiresAt = '2026-11-20T00:00:00Z'): Promise<string> {
  const id = uuidv7();
  await client`insert into auth_sessions (id, user_id, token, expires_at, user_agent)
               values (${id}, ${userId}, ${'gizli-' + id}, ${expiresAt}, 'Firefox')`;
  return id;
}

const deps = () => ({ store: createDrizzleAccountStore(database), clock });

beforeAll(async () => {
  testDb = await startTestDatabase();
  client = createSqlClient(testDb.url, 5);
  database = drizzle(client, { schema });
});

beforeEach(async () => {
  await client`truncate users cascade`;
});

afterAll(async () => {
  await client?.end({ timeout: 5 });
  await testDb?.stop();
});

describe('oturum yönetimi (veritabanı)', () => {
  it('BR-ACC-006: yalnızca aktörün süresi dolmamış oturumları listelenir; token alanı dönmez', async () => {
    const a = await newUser('a@ornek.test');
    const b = await newUser('b@ornek.test');
    const current = await newSession(a);
    await newSession(a, '2026-10-01T00:00:00Z'); // süresi dolmuş
    await newSession(b);
    const sessions = await listSessions(deps(), { userId: a, sessionId: current });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ id: current, current: true, userAgent: 'Firefox' });
    expect(Object.keys(sessions[0]!)).not.toContain('token');
  });

  it('BR-PERM-001: başka kullanıcının oturumu kapatılamaz (bulunamadı) ve silinmez', async () => {
    const a = await newUser('a@ornek.test');
    const b = await newUser('b@ornek.test');
    const mine = await newSession(a);
    const theirs = await newSession(b);
    expect(await revokeSession(deps(), { userId: a, sessionId: mine }, theirs)).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    });
    const [row] = await client<
      { n: number }[]
    >`select count(*)::int as n from auth_sessions where id = ${theirs}`;
    expect(row?.n).toBe(1);
  });

  it('BR-ACC-006: diğer oturumları kapatma bu oturumu ve başka kullanıcıları etkilemez', async () => {
    const a = await newUser('a@ornek.test');
    const b = await newUser('b@ornek.test');
    const current = await newSession(a);
    await newSession(a);
    await newSession(a);
    const other = await newSession(b);
    await revokeOtherSessions(deps(), { userId: a, sessionId: current });
    const rows = await client<{ id: string }[]>`select id from auth_sessions order by id`;
    expect(rows.map((r) => r.id).sort()).toEqual([current, other].sort());
  });

  it('ad güncellenir; veritabanı 100 karakterden uzun adı kabul etmez', async () => {
    const a = await newUser('a@ornek.test');
    await createDrizzleAccountStore(database).updateName(a, 'Elif Yılmaz', clock.now());
    const [row] = await client<{ name: string }[]>`select name from users where id = ${a}`;
    expect(row?.name).toBe('Elif Yılmaz');
    await expect(
      createDrizzleAccountStore(database).updateName(a, 'x'.repeat(101), clock.now()),
    ).rejects.toThrow();
  });
});
