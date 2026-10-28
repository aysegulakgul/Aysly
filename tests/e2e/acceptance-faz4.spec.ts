import { expect, test, type Browser, type Page } from '@playwright/test';
import { E2E_BASE_URL } from './e2e-env';
import { signUp } from './helpers';

/** Faz 4 kabul senaryoları (TESTING_STRATEGY §6). AC-09 sunucu saatine bağlı olduğundan birim testiyle doğrulanır. */
const origin = { origin: E2E_BASE_URL };
const isMobile = () => test.info().project.name === 'mobile';

const inboxBadge = (page: Page) =>
  isMobile()
    ? page.getByText(/açık görev\.$/)
    : page.getByRole('navigation', { name: 'Ana menü' }).getByRole('link', { name: /Inbox/ });

async function newUser(browser: Browser) {
  const context = await browser.newContext({ locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const page = await context.newPage();
  await signUp(page);
  const ws = (await (await page.request.get('/api/v1/workspaces')).json()).data[0].id as string;
  return { context, page, ws };
}

test.describe('Faz 4 kabul', () => {
  test('AC-01: kayıt, onboarding atlanır, Q ile ilk görev Inbox’a eklenir ve sayaç 1 olur', async ({
    page,
  }) => {
    await signUp(page, undefined, undefined, { keepOnboarding: true });
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Atla' }).click();
    await expect(page).toHaveURL('/');
    await page.goto('/inbox');
    await expect(page.getByText('Açık görev yok.', { exact: false })).toBeVisible();

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('q');
    await expect(page).toHaveURL('/inbox?add=1');
    await page.getByLabel('Hızlı ekle').fill('Fatura öde');
    await page.getByLabel('Hızlı ekle').press('Enter');
    await expect(page.getByRole('listitem').filter({ hasText: 'Fatura öde' })).toBeVisible();
    await expect(inboxBadge(page)).toContainText('1');
  });

  test('AC-02: Inbox’taki iki görev Ev’e taşınır; sayaç 1 olur, tarih ve etiketler korunur', async ({
    page,
  }) => {
    // Not: çoklu seçim (BR-TASK-008) Faz 5'te; burada iki görev tek tek taşınır, sonuç aynıdır.
    await signUp(page, undefined, undefined, { keepOnboarding: true });
    await page.request.post('/api/v1/me/onboarding', {
      data: { intents: ['personal'], createSamples: true },
      headers: origin,
    });
    const ws = (await (await page.request.get('/api/v1/workspaces')).json()).data[0].id;
    for (const [i, title] of ['A görevi', 'B görevi', 'C görevi'].entries()) {
      await page.request.post(`/api/v1/workspaces/${ws}/tasks`, {
        data: { title, due: { date: '2026-12-0' + (i + 1) }, tagNames: ['ev'] },
        headers: { ...origin, 'idempotency-key': `ac02-${Date.now()}-${i}` },
      });
    }
    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');
    for (const title of ['A görevi', 'B görevi']) {
      const row = page.getByRole('listitem').filter({ hasText: title });
      await row
        .getByRole('button', { name: /Projeye taşı/ })
        .first()
        .click();
      await page.getByRole('button', { name: 'Ev', exact: true }).click();
      await expect(row).toHaveCount(0);
    }
    await expect(page.getByText('1 açık görev.')).toBeVisible();

    const tasks = (
      await (await page.request.get(`/api/v1/workspaces/${ws}/my-tasks`)).json()
    ).data.flatMap((g: { tasks: unknown[] }) => g.tasks) as {
      title: string;
      project: { name: string };
      due: { date: string };
      tags: { name: string }[];
    }[];
    const moved = tasks.filter((t) => t.project.name === 'Ev');
    expect(moved.map((t) => t.title).sort()).toEqual(['A görevi', 'B görevi']);
    expect(moved.every((t) => t.tags[0]?.name === 'ev' && t.due.date.startsWith('2026-12-0'))).toBe(
      true,
    );
  });

  test('AC-03: bugün tarihli görev tamamlanınca Bugün’den kalkar; "Geri al" geri getirir', async ({
    page,
  }) => {
    await signUp(page);
    const ws = (await (await page.request.get('/api/v1/workspaces')).json()).data[0].id;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(
      new Date(),
    );
    await page.request.post(`/api/v1/workspaces/${ws}/tasks`, {
      data: { title: 'Bugünkü görev', due: { date: today } },
      headers: { ...origin, 'idempotency-key': `ac03-${Date.now()}` },
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const todayPanel = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { level: 2, name: 'Bugün', exact: true }) });
    await todayPanel.getByRole('button', { name: 'Tamamla: Bugünkü görev' }).click();
    await expect(todayPanel).not.toContainText('Bugünkü görev');
    await page.getByRole('button', { name: 'Geri al' }).click();
    await expect(todayPanel).toContainText('Bugünkü görev');
    await page.reload();
    await expect(todayPanel).toContainText('Bugünkü görev');
  });

  test('AC-07: A, B’nin görev adresini açınca "bulunamadı" görür; yanıtta B verisi yoktur', async ({
    browser,
  }) => {
    const a = await newUser(browser);
    const b = await newUser(browser);
    const secret = (
      await (
        await b.page.request.post(`/api/v1/workspaces/${b.ws}/tasks`, {
          data: { title: 'B’nin gizli görevi' },
          headers: { ...origin, 'idempotency-key': `ac07-${Date.now()}` },
        })
      ).json()
    ).data;
    const response = await a.page.goto(`/my-tasks?task=${secret.id}`);
    await expect(a.page.getByText('Görev bulunamadı ya da erişimin yok.')).toBeVisible();
    expect(await response!.text()).not.toContain('B’nin gizli görevi');
    const api = await a.page.request.get(`/api/v1/workspaces/${b.ws}/tasks/${secret.id}`);
    expect(api.status()).toBe(404);
    expect(await api.text()).not.toContain('gizli');
    await a.context.close();
    await b.context.close();
  });
});
