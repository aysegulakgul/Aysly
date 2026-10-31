import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { E2E_BASE_URL } from './e2e-env';
import { signUp } from './helpers';

/** Faz 5 kabul senaryoları (IMPLEMENTATION_PLAN Faz 5, TESTING_STRATEGY §6). */
const origin = { origin: E2E_BASE_URL };
let seq = 0;
const key = () => `faz5-${Date.now()}-${++seq}`;

async function workspace(page: Page) {
  return (await (await page.request.get('/api/v1/workspaces')).json()).data[0].id as string;
}

async function createProject(page: Page, ws: string, name: string) {
  const res = await page.request.post(`/api/v1/workspaces/${ws}/projects`, {
    data: { name, color: 'green' },
    headers: { ...origin, 'idempotency-key': key() },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).data.id as string;
}

async function createTask(page: Page, ws: string, data: Record<string, unknown>) {
  const res = await page.request.post(`/api/v1/workspaces/${ws}/tasks`, {
    data,
    headers: { ...origin, 'idempotency-key': key() },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).data as { id: string; version: number };
}

test.describe('Faz 5 kabul', () => {
  test('AC-06: 5 görevli proje silinir, çöpte tek grup görünür, geri yüklenince proje ve görevler döner', async ({
    page,
  }) => {
    await signUp(page);
    const ws = await workspace(page);
    const id = await createProject(page, ws, 'Müşteri A');
    for (const title of ['G1', 'G2', 'G3', 'G4', 'G5']) {
      await createTask(page, ws, { title, projectId: id });
    }
    await page.goto(`/projects/${id}`);
    await expect(page.getByRole('heading', { name: 'Müşteri A' })).toBeVisible();
    await expect(page.getByText('0/5 üst düzey görev · %0')).toBeVisible();
    await page.getByRole('button', { name: 'Proje işlemleri' }).click();
    await page.getByRole('button', { name: 'Sil' }).click();
    await expect(page.getByRole('dialog')).toContainText('5 görev (5 ana görev + 0 alt görev)');
    await page.getByRole('button', { name: 'Çöpe taşı' }).click();
    await expect(page).toHaveURL(/\/projects\?deleted=/);
    await expect(page.locator('[data-project-card]')).toHaveCount(0);

    await page.goto('/trash');
    const rows = page.locator('[data-trash-row]');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Proje: Müşteri A (+5 görev)');
    await rows.first().getByRole('button', { name: 'Geri yükle' }).click();
    await expect(page.getByText('Geri yüklendi.')).toBeVisible();
    await expect(rows).toHaveCount(0);

    await page.goto(`/projects/${id}`);
    for (const title of ['G1', 'G2', 'G3', 'G4', 'G5']) {
      await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
    }
  });

  test('AC-02 (çoklu seçim): Görevlerim’de 2 görev seçilip Ev’e taşınır; tarih ve etiketler korunur', async ({
    page,
  }) => {
    await signUp(page);
    const ws = await workspace(page);
    await createProject(page, ws, 'Ev');
    for (const [i, title] of ['A görevi', 'B görevi', 'C görevi'].entries()) {
      await createTask(page, ws, { title, due: { date: `2026-12-0${i + 1}` }, tagNames: ['ev'] });
    }
    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Seç', exact: true }).click();
    await page.getByRole('checkbox', { name: 'A görevi görevini seç' }).check();
    await page.getByRole('checkbox', { name: 'B görevi görevini seç' }).check();
    const bar = page.getByRole('toolbar', { name: 'Toplu işlemler' });
    await expect(bar).toContainText('2 görev seçildi');
    await bar.getByRole('button', { name: 'Projeye taşı' }).click();
    await page.getByRole('button', { name: 'Ev', exact: true }).click();
    await expect(page.getByText('2 görev güncellendi.')).toBeVisible();

    const tasks = (
      await (await page.request.get(`/api/v1/workspaces/${ws}/tasks?status=todo`)).json()
    ).data as {
      title: string;
      project: { name: string };
      due: { date: string };
      tags: { name: string }[];
    }[];
    const moved = tasks.filter((t) => t.project.name === 'Ev');
    expect(moved.map((t) => t.title).sort()).toEqual(['A görevi', 'B görevi']);
    expect(moved.every((t) => t.due && t.tags[0]?.name === 'ev')).toBe(true);
  });

  test('BR-TASK-008: toplu işlem atomiktir — reddedilen bir görev varsa hiçbiri değişmez', async ({
    page,
  }) => {
    await signUp(page);
    const ws = await workspace(page);
    const a = await createTask(page, ws, { title: 'Bir' });
    const res = await page.request.post(`/api/v1/workspaces/${ws}/tasks/bulk`, {
      data: { action: 'complete', taskIds: [a.id, '01900000-0000-7000-8000-00000000dead'] },
      headers: origin,
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('BULK_OPERATION_REJECTED');
    expect(body.error.failures).toHaveLength(1);
    const task = (await (await page.request.get(`/api/v1/workspaces/${ws}/tasks/${a.id}`)).json())
      .data;
    expect(task.status).toBe('todo');
  });

  test('FR-VIEW-06: listeden panoya geçişte filtre ve sıralama korunur; panoda durum menüden değişir', async ({
    page,
  }) => {
    await signUp(page);
    const ws = await workspace(page);
    const id = await createProject(page, ws, 'Web');
    await createTask(page, ws, { title: 'Yüksek iş', projectId: id, priority: 3 });
    await createTask(page, ws, { title: 'Düşük iş', projectId: id, priority: 1 });
    await page.goto(`/projects/${id}?priority=3&sort=title`);
    await expect(page.getByRole('link', { name: 'Yüksek iş', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Düşük iş', exact: true })).toHaveCount(0);

    await page.locator('[data-view-tab="board"]').click();
    await expect(page).toHaveURL(/view=board/);
    await expect(page).toHaveURL(/priority=3/);
    await expect(page).toHaveURL(/sort=title/);
    const todo = page.locator('[data-board-column="todo"]');
    await expect(todo.getByText('Yüksek iş')).toBeVisible();
    await expect(page.getByText('Düşük iş')).toHaveCount(0);

    await page.getByRole('button', { name: 'Yüksek iş için işlemler' }).click();
    await page.getByRole('button', { name: /Devam ediyor/ }).click();
    await expect(
      page.locator('[data-board-column="in_progress"]').getByText('Yüksek iş'),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.locator('[data-board-column="in_progress"]').getByText('Yüksek iş'),
    ).toBeVisible();

    await page.locator('[data-view-tab="list"]').click();
    await expect(page).toHaveURL(/priority=3/);
    await expect(page).not.toHaveURL(/view=board/);
  });

  test('BR-PROJ-003: proje ilerlemesi listede ve kenar çubuğunda doğrudur', async ({ page }) => {
    await signUp(page);
    const ws = await workspace(page);
    const id = await createProject(page, ws, 'Okul');
    const tasks = [];
    for (const title of ['1', '2', '3'])
      tasks.push(await createTask(page, ws, { title, projectId: id }));
    await page.request.post(`/api/v1/workspaces/${ws}/tasks/${tasks[0]!.id}/complete`, {
      data: { version: tasks[0]!.version },
      headers: origin,
    });
    await page.goto('/projects');
    const card = page.locator('[data-project-card]').first();
    await expect(card).toContainText('1/3 görev tamamlandı');
    await expect(card).toContainText('%33');
    if (test.info().project.name === 'desktop') {
      await expect(page.getByRole('link', { name: 'Okul · %33' })).toBeVisible();
    }
  });

  test('FR-VIEW-07: filtre kayıtlı görünüm olarak saklanır ve kenar çubuğundan açılır', async ({
    page,
  }) => {
    await signUp(page);
    const ws = await workspace(page);
    await createTask(page, ws, { title: 'Acil', priority: 3 });
    await createTask(page, ws, { title: 'Sakin', priority: 0 });
    await page.goto('/views/new?priority=3');
    await expect(page.getByRole('link', { name: 'Acil', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Görünümü kaydet' }).click();
    await page.getByLabel('Görünüm adı').fill('Yüksek öncelik');
    await page.getByRole('dialog').getByRole('button', { name: 'Görünümü kaydet' }).click();
    await expect(page).toHaveURL(/\/views\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: /Yüksek öncelik/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Acil', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sakin', exact: true })).toHaveCount(0);
  });

  for (const path of ['/projects', '/trash', '/archive', '/settings/tags', '/views/new']) {
    test(`${path} erişilebilirlik taraması (AC-11)`, async ({ page }) => {
      await signUp(page);
      const ws = await workspace(page);
      const id = await createProject(page, ws, 'Tarama');
      await createTask(page, ws, { title: 'Tarama görevi', projectId: id, tagNames: ['etiket'] });
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }

  test('proje sayfası (liste ve pano) erişilebilirlik taraması (AC-11)', async ({ page }) => {
    await signUp(page);
    const ws = await workspace(page);
    const id = await createProject(page, ws, 'Tarama');
    await createTask(page, ws, { title: 'Bir', projectId: id, tagNames: ['a'] });
    for (const suffix of ['', '?view=board']) {
      await page.goto(`/projects/${id}${suffix}`);
      await expect(page.getByRole('main')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    }
  });
});
