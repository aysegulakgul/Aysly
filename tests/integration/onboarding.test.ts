import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerUser } from '@/modules/identity/application/register-user';
import { createDrizzleRegistrationStore } from '@/modules/identity/infrastructure/drizzle-registration-store';
import {
  completeOnboarding,
  restartOnboarding,
  skipOnboarding,
} from '@/modules/preferences/application/onboarding';
import { createDrizzleOnboardingStore } from '@/modules/preferences/infrastructure/drizzle-onboarding-store';
import { createSqlClient, type Database } from '@/shared/db/client';
import * as schema from '@/shared/db/schema';
import { fixedClock } from '@/shared/kernel/clock';
import { uuidv7 } from '@/shared/kernel/id';
import { startTestDatabase } from '../fixtures/test-database';

let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let client: ReturnType<typeof createSqlClient>;
let database: Database;
const clock = fixedClock(new Date('2026-10-28T09:00:00Z'));
const deps = () => ({ store: createDrizzleOnboardingStore(database), clock });

async function newUser(email: string, locale: 'tr' | 'en' = 'tr'): Promise<string> {
  const result = await registerUser(
    {
      store: createDrizzleRegistrationStore(database),
      hasher: { hash: async () => 'hash' },
      clock,
      newId: uuidv7,
    },
    { name: 'Test', email, password: 'ayisigi gece 2026', locale },
  );
  if (!result.ok) throw new Error('kayıt başarısız');
  return result.value.userId;
}

const projectsOf = (userId: string) =>
  client<{ name: string; kind: string; position: string; description: string | null }[]>`
    select p.name, p.kind, p.position, p.description from projects p
    join workspaces w on w.id = p.workspace_id where w.owner_user_id = ${userId}
    order by p.position`;

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

describe('onboarding (veritabanı)', () => {
  it('örnek projeler kişisel alanda Inbox’tan sonra sırayla oluşturulur; düzen ve durum kaydedilir', async () => {
    const userId = await newUser('a@ornek.test');
    const other = await newUser('b@ornek.test');
    const result = await completeOnboarding(
      deps(),
      { userId },
      {
        intents: ['personal', 'work'],
        createSamples: true,
      },
    );
    expect(result).toMatchObject({
      ok: true,
      value: { status: 'completed', samplesCreated: true },
    });
    expect(await projectsOf(userId)).toEqual([
      { name: 'Inbox', kind: 'inbox', position: 'a0', description: null },
      { name: 'Ev', kind: 'standard', position: 'a1', description: null },
      { name: 'İş', kind: 'standard', position: 'a2', description: null },
    ]);
    expect(await projectsOf(other)).toHaveLength(1); // başka kullanıcı etkilenmez

    const [prefs] = await client<
      { dashboard_layout: { widgets: { id: string; visible: boolean }[] } }[]
    >`
      select dashboard_layout from user_preferences where user_id = ${userId}`;
    expect(prefs?.dashboard_layout.widgets.filter((w) => w.visible).map((w) => w.id)).toEqual([
      'today',
      'overdue',
      'upcoming',
      'projects',
      'goals',
    ]);
  });

  it('yeniden başlatılıp tekrar tamamlansa da örnek projeler ikinci kez oluşturulmaz', async () => {
    const userId = await newUser('a@ornek.test', 'en');
    await completeOnboarding(deps(), { userId }, { intents: ['work'], createSamples: true });
    await restartOnboarding(deps(), { userId });
    await completeOnboarding(deps(), { userId }, { intents: ['work'], createSamples: true });
    expect((await projectsOf(userId)).map((p) => p.name)).toEqual(['Inbox', 'Work']);
  });

  it('atlama projeleri oluşturmaz ve düzeni değiştirmez; tamamlanmış onboarding atlanamaz', async () => {
    const userId = await newUser('a@ornek.test');
    const skipped = await skipOnboarding(deps(), { userId });
    expect(skipped).toMatchObject({ ok: true, value: { status: 'pending', skips: 1 } });
    expect(await projectsOf(userId)).toHaveLength(1);
    await completeOnboarding(deps(), { userId }, { intents: [], createSamples: true });
    expect(await skipOnboarding(deps(), { userId })).toMatchObject({
      value: { status: 'completed', skips: 1 },
    });
    expect(await projectsOf(userId)).toHaveLength(1); // amaç yoksa örnek proje yok
  });
});
