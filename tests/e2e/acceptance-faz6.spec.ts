import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { E2E_BASE_URL } from './e2e-env';
import { signUp } from './helpers';

/** Faz 6 kabul senaryoları (IMPLEMENTATION_PLAN Faz 6, TESTING_STRATEGY §6). */
const origin = { origin: E2E_BASE_URL };
let seq = 0;
const key = () => `faz6-${Date.now()}-${++seq}`;
const isMobile = () => test.info().project.name === 'mobile';

async function workspace(page: Page) {
  return (await (await page.request.get('/api/v1/workspaces')).json()).data[0].id as string;
}

async function createTask(page: Page, ws: string, data: Record<string, unknown>) {
  const res = await page.request.post(`/api/v1/workspaces/${ws}/tasks`, {
    data,
    headers: { ...origin, 'idempotency-key': key() },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).data as { id: string; version: number };
}

/** Kullanıcının saat dilimindeki (Europe/Istanbul) bugün ve ona göre gün kaydırma. */
const istanbulToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

test.describe('Faz 6 kabul', () => {
  test('AC-04: haftalık tekrarlayan görev tamamlanınca bir hafta sonrası için yeni açık örnek oluşur', async ({
    page,
  }) => {
    await signUp(page);
    const ws = await workspace(page);
    const today = istanbulToday();
    await createTask(page, ws, {
      title: 'Haftalık plan',
      due: { date: today },
      recurrence: { rule: 'FREQ=WEEKLY', mode: 'fixed_schedule' },
    });
    await page.goto('/my-tasks');
    const row = page.locator('[data-task-row]').filter({ hasText: 'Haftalık plan' });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('↻');
    await row.locator('[data-complete]').click();
    await expect(page.getByText('Görev tamamlandı', { exact: false })).toBeVisible();
    await page.reload();
    // D-106: tamamlanan örnek de listede kalır; yeni açık örnek eklenir.
    await expect(page.locator('[data-task-row]').filter({ hasText: 'Haftalık plan' })).toHaveCount(
      2,
    );
    const tasks = (
      await (
        await page.request.get(`/api/v1/workspaces/${ws}/tasks?status=todo&status=done`)
      ).json()
    ).data as { title: string; status: string; due: { date: string } }[];
    const series = tasks.filter((x) => x.title === 'Haftalık plan');
    expect(series.map((x) => [x.status, x.due.date]).sort()).toEqual(
      [
        ['done', today],
        ['todo', shift(today, 7)],
      ].sort(),
    );
  });

  test('AC-04: "tamamlandıktan 3 gün sonra" modunda yeni örnek tamamlanma gününden 3 gün sonradır', async ({
    page,
  }) => {
    await signUp(page);
    const ws = await workspace(page);
    const today = istanbulToday();
    const task = await createTask(page, ws, {
      title: 'Bitki sula',
      due: { date: shift(today, -5) },
      recurrence: { rule: 'FREQ=DAILY;INTERVAL=3', mode: 'after_completion' },
    });
    const res = await page.request.post(`/api/v1/workspaces/${ws}/tasks/${task.id}/complete`, {
      data: { version: task.version },
      headers: origin,
    });
    expect((await res.json()).data.nextOccurrence.due.date).toBe(shift(today, 3));
  });

  test('AC-05: 1 dakika sonrası için hatırlatıcı; süre dolunca tek bildirim görünür ve tıklanınca görev açılır', async ({
    page,
  }) => {
    test.skip(isMobile(), 'Zamanlamaya bağlı senaryo masaüstünde bir kez çalıştırılır.');
    test.setTimeout(150_000);
    await signUp(page);
    const ws = await workspace(page);
    const task = await createTask(page, ws, { title: 'İlacı al' });
    const remindAt = new Date(Date.now() + 65_000).toISOString();
    const added = await page.request.post(`/api/v1/workspaces/${ws}/tasks/${task.id}/reminders`, {
      data: { kind: 'absolute', remindAt },
      headers: origin,
    });
    expect(added.status()).toBe(201);
    await page.goto('/inbox');
    const bell = page.getByRole('button', { name: /^Bildirimler/ }).first();
    await expect(bell).toHaveAccessibleName('Bildirimler');
    await page.waitForTimeout(Date.parse(remindAt) - Date.now() + 1_000);
    // İki kez yoklansa da tek bildirim (BR-REM-005, BR-NOTIF-002).
    await page.request.get('/api/v1/notifications/unread-count');
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Bildirimler, 1 okunmamış' }).first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Bildirimler, 1 okunmamış' }).first().click();
    const item = page
      .getByRole('dialog', { name: 'Bildirimler' })
      .getByRole('button', { name: /İlacı al/ });
    await expect(item).toHaveCount(1);
    await item.click();
    await expect(page).toHaveURL(new RegExp(`/my-tasks\\?task=${task.id}`));
    await expect(
      page.getByRole('heading', { name: 'Görev detayı' }).or(page.getByLabel('Başlık')),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Bildirimler', exact: true }).first(),
    ).toBeVisible();
  });

  test('görev detayında hatırlatıcı ve tekrar kurulur; tarih değişince kapsam sorulur (BR-REM-001, BR-REC-006)', async ({
    page,
  }) => {
    await signUp(page);
    const ws = await workspace(page);
    const today = istanbulToday();
    const task = await createTask(page, ws, { title: 'Spor', due: { date: shift(today, 2) } });
    await page.goto(`/my-tasks?task=${task.id}`);
    await page.getByRole('button', { name: 'Hatırlatıcı ekle' }).click();
    await page.getByRole('button', { name: '1 gün önce' }).click();
    await expect(page.getByText(/^1 gün önce · /)).toBeVisible();

    await page.locator('#detail-recurrence').click();
    await page.getByLabel('Sıklık').selectOption('WEEKLY');
    await page.getByRole('button', { name: 'Uygula' }).click();
    await expect(page.locator('#detail-recurrence')).toContainText('Her hafta');

    const detail = (
      await (await page.request.get(`/api/v1/workspaces/${ws}/tasks/${task.id}`)).json()
    ).data;
    expect(detail.recurrence.rule).toMatch(/^FREQ=WEEKLY;BYDAY=/);
    expect(detail.reminders).toHaveLength(1);
  });

  test('takvim: görev kendi gününde görünür; masaüstünde sürükleyerek başka güne taşınır (FR-CAL-02/03)', async ({
    page,
  }) => {
    await signUp(page);
    const ws = await workspace(page);
    const today = istanbulToday();
    await createTask(page, ws, { title: 'Takvim görevi', due: { date: today } });
    await createTask(page, ws, { title: 'Tarihsiz iş' });
    if (isMobile()) {
      await page.goto('/calendar');
      await expect(page.getByRole('heading', { name: 'Tüm gün' })).toBeVisible();
      await expect(page.getByRole('link', { name: /Takvim görevi/ })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Tarihsiz' })).toBeVisible();
      return;
    }
    await page.goto(`/calendar?cal=week&date=${today}`);
    const source = page.locator(`[data-calendar-day="${today}"] [data-calendar-task]`);
    await expect(source).toContainText('Takvim görevi');
    const target = shift(today, today.endsWith('01') ? 1 : -1);
    await page.goto(`/calendar?cal=month&date=${today}`);
    await page
      .locator(`[data-calendar-day="${today}"] [data-calendar-task]`)
      .dragTo(page.locator(`[data-calendar-day="${target}"]`));
    await expect(page.locator(`[data-calendar-day="${target}"]`)).toContainText('Takvim görevi');
    await expect(page.getByRole('heading', { name: 'Tarihsiz' })).toBeVisible();
  });

  for (const path of ['/calendar', '/notifications', '/settings/notifications']) {
    test(`${path} erişilebilirlik taraması (AC-11)`, async ({ page }) => {
      await signUp(page);
      const ws = await workspace(page);
      await createTask(page, ws, { title: 'Tarama', due: { date: istanbulToday() } });
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
});
