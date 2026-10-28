import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerUser } from '@/modules/identity/application/register-user';
import { createDrizzleRegistrationStore } from '@/modules/identity/infrastructure/drizzle-registration-store';
import { dashboard, listSummaries, myTasks } from '@/modules/tasks/application/organize';
import { listTasks } from '@/modules/tasks/application/tasks';
import { taskDeps } from '@/modules/tasks/http/task-handlers';
import { resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { createSqlClient, type Database } from '@/shared/db/client';
import * as schema from '@/shared/db/schema';
import { fixedClock } from '@/shared/kernel/clock';
import { uuidv7 } from '@/shared/kernel/id';
import { startTestDatabase } from '../fixtures/test-database';

/**
 * Faz 4 kabulü (IMPLEMENTATION_PLAN): 1.000 görevli çalışma alanında liste sorguları p95 < 300 ms (yerel ölçüm).
 * Use case + veritabanı süresi ölçülür (HTTP katmanı ince bir adaptördür).
 */
let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let client: ReturnType<typeof createSqlClient>;
let database: Database;
let scope: WorkspaceScope;
const clock = fixedClock(new Date('2026-10-28T09:00:00Z'));
const RUNS = 50;

const p95 = (samples: number[]) =>
  [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * 0.95) - 1]!;

async function measure(run: () => Promise<unknown>): Promise<number> {
  // Isınma: bağlantı havuzu, sorgu planları ve JIT; ölçüme dahil edilmez.
  for (let i = 0; i < 5; i++) await run();
  const samples: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    await run();
    samples.push(performance.now() - start);
  }
  return p95(samples);
}

beforeAll(async () => {
  testDb = await startTestDatabase();
  client = createSqlClient(testDb.url, 5);
  database = drizzle(client, { schema });
  const result = await registerUser(
    {
      store: createDrizzleRegistrationStore(database),
      hasher: { hash: async () => 'hash' },
      clock,
      newId: uuidv7,
    },
    { name: 'Perf', email: 'perf@ornek.test', password: 'ayisigi gece 2026', locale: 'tr' },
  );
  if (!result.ok) throw new Error('kayıt başarısız');
  scope = (await resolveWorkspaceScope(database, result.value.userId, result.value.workspaceId))!;
  const [inbox] = await client<{ id: string }[]>`select id from projects where kind = 'inbox'`;
  // 1.000 üst düzey görev + 300 alt görev; tarihler son 30 ile sonraki 30 gün arasında dağılır.
  const rows = Array.from({ length: 1000 }, (_, i) => ({
    id: uuidv7(),
    workspace_id: scope.workspaceId,
    project_id: inbox!.id,
    title: `Görev ${i}`,
    status: i % 5 === 0 ? 'done' : 'todo',
    completed_at: i % 5 === 0 ? new Date().toISOString() : null,
    priority: i % 4,
    due_date:
      i % 3 === 0 ? null : new Date(Date.UTC(2026, 9, 1 + (i % 60))).toISOString().slice(0, 10),
    position: `a${String(i).padStart(4, '0')}`,
  }));
  await client`insert into tasks ${client(rows)}`;
  const subtasks = rows.slice(0, 300).map((parent, i) => ({
    id: uuidv7(),
    workspace_id: scope.workspaceId,
    project_id: inbox!.id,
    parent_task_id: parent.id,
    title: `Alt ${i}`,
    position: 'a0',
  }));
  await client`insert into tasks ${client(subtasks)}`;
  await client`analyze tasks`;
}, 120_000);

afterAll(async () => {
  await client?.end({ timeout: 5 });
  await testDb?.stop();
});

describe('performans (1.000 görev)', () => {
  const deps = () => ({ ...taskDeps(database), clock });
  const LIMIT_MS = 300;

  it('Inbox listesi (özetlerle) p95 < 300 ms', async () => {
    const time = await measure(async () => {
      const result = await listTasks(deps(), scope, {});
      if (result.ok) await listSummaries(deps(), scope, result.value);
    });
    console.info(`Inbox listesi p95: ${time.toFixed(1)} ms`);
    expect(time).toBeLessThan(LIMIT_MS);
  });

  it('Görevlerim p95 < 300 ms', async () => {
    const time = await measure(() => myTasks(deps(), scope, { today: '2026-10-28', weekStart: 1 }));
    console.info(`Görevlerim p95: ${time.toFixed(1)} ms`);
    expect(time).toBeLessThan(LIMIT_MS);
  });

  it('Bugün bölümleri p95 < 300 ms', async () => {
    const time = await measure(() =>
      dashboard(deps(), scope, { today: '2026-10-28', weekStart: 1 }),
    );
    console.info(`Bugün bölümleri p95: ${time.toFixed(1)} ms`);
    expect(time).toBeLessThan(LIMIT_MS);
  });
});
