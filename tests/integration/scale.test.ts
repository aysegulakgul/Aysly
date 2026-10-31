import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exportAccount } from '@/modules/data-portability/application/export';
import { createSqlExportReader } from '@/modules/data-portability/infrastructure/sql-export-reader';
import { registerUser } from '@/modules/identity/application/register-user';
import { createDrizzleRegistrationStore } from '@/modules/identity/infrastructure/drizzle-registration-store';
import { noteDeps } from '@/modules/notes';
import { listNotes } from '@/modules/notes/application/notes';
import { createSqlSearchIndex } from '@/modules/search';
import { searchEverything } from '@/modules/search/application/search';
import {
  dashboard,
  listSummaries,
  myTasks,
  sidebarCounts,
} from '@/modules/tasks/application/organize';
import { projectOverview } from '@/modules/tasks/application/projects';
import { createTask, listTasks } from '@/modules/tasks/application/tasks';
import { taskDeps } from '@/modules/tasks/http/task-handlers';
import { resolveWorkspaceScope, type WorkspaceScope } from '@/modules/workspaces';
import { createSqlClient, type Database } from '@/shared/db/client';
import * as schema from '@/shared/db/schema';
import { fixedClock } from '@/shared/kernel/clock';
import { uuidv7 } from '@/shared/kernel/id';
import { startTestDatabase } from '../fixtures/test-database';

/**
 * Faz 8 kabulü — NFR-03 ölçeği (10.000 görev, 500 proje, 5.000 not) ile NFR-01 eşikleri: okuma p95 < 300 ms,
 * yazma p95 < 500 ms. Yerel ölçüm; use case + veritabanı süresi (HTTP katmanı ince bir adaptördür).
 */
let testDb: Awaited<ReturnType<typeof startTestDatabase>>;
let client: ReturnType<typeof createSqlClient>;
let database: Database;
let scope: WorkspaceScope;
let busyProjectId: string;
const clock = fixedClock(new Date('2026-10-30T09:00:00Z'));
const RUNS = 20;
const READ_MS = 300;
const WRITE_MS = 500;

const p95 = (samples: number[]) =>
  [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * 0.95) - 1]!;

async function measure(label: string, run: () => Promise<unknown>): Promise<number> {
  for (let i = 0; i < 3; i++) await run(); // ısınma
  const samples: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    await run();
    samples.push(performance.now() - start);
  }
  const time = p95(samples);
  console.info(`${label} p95: ${time.toFixed(1)} ms`);
  return time;
}

async function insertInChunks(table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 1000) {
    await client`insert into ${client(table)} ${client(rows.slice(i, i + 1000))}`;
  }
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
    { name: 'Ölçek', email: 'olcek@ornek.test', password: 'ayisigi gece 2026', locale: 'tr' },
  );
  if (!result.ok) throw new Error('kayıt başarısız');
  scope = (await resolveWorkspaceScope(database, result.value.userId, result.value.workspaceId))!;
  const ws = scope.workspaceId;

  const projects = Array.from({ length: 500 }, (_, i) => ({
    id: uuidv7(),
    workspace_id: ws,
    kind: 'standard',
    color: 'blue',
    name: `Proje ${i}`,
    position: `a${String(i).padStart(4, '0')}`,
  }));
  await insertInChunks('projects', projects);
  busyProjectId = projects[0]!.id;
  const [inbox] = await client<{ id: string }[]>`select id from projects where kind = 'inbox'`;

  // 10.000 görev: yarısı Inbox'ta, yarısı projelere dağılmış; 1.000 tanesi ilk projede (en kalabalık liste).
  const tasks = Array.from({ length: 10_000 }, (_, i) => ({
    id: uuidv7(),
    workspace_id: ws,
    project_id: i < 1000 ? busyProjectId : i % 2 === 0 ? inbox!.id : projects[i % 500]!.id,
    title: i % 97 === 0 ? `Işık faturası ${i}` : `Görev ${i}`,
    status: i % 5 === 0 ? 'done' : 'todo',
    completed_at: i % 5 === 0 ? '2026-10-20T09:00:00Z' : null,
    priority: i % 4,
    due_date:
      i % 3 === 0 ? null : new Date(Date.UTC(2026, 9, 1 + (i % 60))).toISOString().slice(0, 10),
    position: `a${String(i).padStart(5, '0')}`,
  }));
  await insertInChunks('tasks', tasks);

  const notes = Array.from({ length: 5000 }, (_, i) => ({
    id: uuidv7(),
    workspace_id: ws,
    title: `Not ${i}`,
    body: `Toplantı ${i}\n\n- madde bir\n- madde iki`,
  }));
  await insertInChunks('notes', notes);
  await client`analyze`;
}, 300_000);

afterAll(async () => {
  await client?.end({ timeout: 5 });
  await testDb?.stop();
});

describe('ölçek (NFR-03: 10.000 görev, 500 proje, 5.000 not)', () => {
  const tasks = () => ({ ...taskDeps(database), clock });

  it('NFR-01: görev listeleri ve Bugün bölümleri p95 < 300 ms', async () => {
    const inbox = await measure('Inbox listesi', async () => {
      const result = await listTasks(tasks(), scope, {});
      if (result.ok) await listSummaries(tasks(), scope, result.value);
    });
    const project = await measure('En kalabalık proje (1.000 görev)', async () => {
      const result = await listTasks(tasks(), scope, { projectId: busyProjectId });
      if (result.ok) await listSummaries(tasks(), scope, result.value);
    });
    const mine = await measure('Görevlerim', () =>
      myTasks(tasks(), scope, { today: '2026-10-30', weekStart: 1 }),
    );
    const today = await measure('Bugün bölümleri', () =>
      dashboard(tasks(), scope, { today: '2026-10-30', weekStart: 1 }),
    );
    // Her sayfada çalışan kenar çubuğu sayıları ayrıca çok hızlı olmalı (görev yüklemeden sayım).
    const counts = await measure('Kenar çubuğu sayıları', () =>
      sidebarCounts(tasks(), scope, '2026-10-30'),
    );
    for (const time of [inbox, project, mine, today]) expect(time).toBeLessThan(READ_MS);
    expect(counts).toBeLessThan(READ_MS);
  });

  it('NFR-01: projeler, notlar ve arama p95 < 300 ms', async () => {
    const projects = await measure('Proje listesi (500, ilerlemeyle)', () =>
      projectOverview(tasks(), scope, {}),
    );
    const notes = await measure('Not listesi (5.000)', () =>
      listNotes({ ...noteDeps(database), clock }, scope, {}),
    );
    const search = await measure('Genel arama', () =>
      searchEverything(createSqlSearchIndex(database), scope, { q: 'isik' }),
    );
    for (const time of [projects, notes, search]) expect(time).toBeLessThan(READ_MS);
  });

  it('NFR-01: görev oluşturma p95 < 500 ms', async () => {
    let i = 0;
    const write = await measure('Görev oluşturma', () =>
      createTask(tasks(), scope, { title: `Yeni ${i++}` }),
    );
    expect(write).toBeLessThan(WRITE_MS);
  });

  it('D-046: 15.000 kayıtlık çalışma alanı dışa aktarılabilir (ölçüm)', async () => {
    const start = performance.now();
    const result = await exportAccount(
      { reader: createSqlExportReader(database), clock, verifyPassword: async () => true },
      { userId: scope.userId, workspaceId: scope.workspaceId },
      { currentPassword: 'x' },
    );
    const ms = performance.now() - start;
    const bytes = JSON.stringify(result.ok ? result.value : null).length;
    console.info(`Dışa aktarma: ${ms.toFixed(0)} ms, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
    expect(result.ok && result.value.content.tasks!.length).toBeGreaterThanOrEqual(10_000);
    expect(ms).toBeLessThan(10_000);
  });
});
