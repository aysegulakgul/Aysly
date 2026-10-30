import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { E2E_BASE_URL } from './e2e-env';
import { signUp } from './helpers';

/** Faz 7 kabul senaryoları (IMPLEMENTATION_PLAN Faz 7, TESTING_STRATEGY §6). */
const origin = { origin: E2E_BASE_URL };
let seq = 0;
const key = () => `faz7-${Date.now()}-${++seq}`;
const isMobile = () => test.info().project.name === 'mobile';

async function workspace(page: Page) {
  return (await (await page.request.get('/api/v1/workspaces')).json()).data[0].id as string;
}

async function post(page: Page, path: string, data: Record<string, unknown>) {
  const res = await page.request.post(path, {
    data,
    headers: { ...origin, 'idempotency-key': key() },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).data as { id: string; version: number };
}

async function expectNoSeriousA11y(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
}

test.describe('Faz 7 kabul', () => {
  test('AC-08 / BR-NOTE-001: not otomatik kaydedilir; çevrimdışıyken yerelde saklanır, bağlantı gelince kaydedilir', async ({
    page,
  }) => {
    await signUp(page);
    await page.goto('/notes');
    await page.getByRole('button', { name: 'Not oluştur' }).first().click();
    await page.getByLabel('Not başlığı').fill('Toplantı notları');
    const editor = page.locator('[data-note-editor]');
    await editor.click();
    await page.keyboard.type('İlk madde');
    const status = page.locator('[data-save-status]');
    await expect(status).toContainText('Kaydedildi', { timeout: 10_000 });
    await expect(page).toHaveURL(/\?note=[0-9a-f-]{36}/);

    await page.reload();
    await expect(page.getByLabel('Not başlığı')).toHaveValue('Toplantı notları');
    await expect(page.locator('[data-note-editor]')).toContainText('İlk madde');

    // Çevrimdışı: kayıt başarısız olur, metin kaybolmaz.
    await page.context().setOffline(true);
    await page.locator('[data-note-editor]').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' ve ikinci madde');
    await expect(status).toContainText('Kaydedilemedi, yerel olarak saklandı', {
      timeout: 10_000,
    });
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(status).toContainText('Kaydedildi', { timeout: 10_000 });

    await page.reload();
    await expect(page.locator('[data-note-editor]')).toContainText('İlk madde ve ikinci madde');

    // FR-NOTE-05: etiket eklenir ve kalıcıdır.
    await page.getByLabel('Etiketler').fill('toplantı');
    const tagged = page.waitForResponse(
      (r) => r.request().method() === 'PATCH' && r.url().includes('/notes/'),
    );
    await page.getByLabel('Etiketler').press('Enter');
    expect((await tagged).status()).toBe(200);
    await expect(page.getByRole('button', { name: 'toplantı etiketini kaldır' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'toplantı etiketini kaldır' })).toBeVisible();
  });

  test('AC-10: genel arama Türkçe harflerden bağımsız; sonuçlar türe göre gruplanır ve açılır', async ({
    page,
  }) => {
    await signUp(page);
    const ws = await workspace(page);
    await post(page, `/api/v1/workspaces/${ws}/tasks`, { title: 'Işık faturasını öde' });
    const note = await post(page, `/api/v1/workspaces/${ws}/notes`, {
      title: 'Işıklandırma fikirleri',
      body: 'Salon için **sarı** ışık',
    });
    await page.goto('/');
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.locator('[data-search-palette]');
    await expect(palette).toBeVisible();
    await palette.getByRole('combobox').fill('isik');
    await expect(palette.getByRole('group', { name: 'Görevler' })).toContainText(
      'Işık faturasını öde',
    );
    await expect(palette.getByRole('group', { name: 'Notlar' })).toContainText(
      'Işıklandırma fikirleri',
    );
    await palette.getByRole('option', { name: /Işıklandırma fikirleri/ }).click();
    await expect(page).toHaveURL(new RegExp(`/notes\\?note=${note.id}`));
    await expect(page.getByLabel('Not başlığı')).toHaveValue('Işıklandırma fikirleri');

    await page.keyboard.press('ControlOrMeta+k');
    await palette.getByRole('combobox').fill('bulunmayan kayit');
    await expect(palette.locator('[data-search-empty]')).toBeVisible();
  });

  test('BR-GOAL-002/003: hedef ilerlemesi bağlı görevlerden hesaplanır; %100 olunca yalnızca önerilir', async ({
    page,
  }) => {
    await signUp(page);
    const ws = await workspace(page);
    const a = await post(page, `/api/v1/workspaces/${ws}/tasks`, { title: 'Bölüm 1' });
    const b = await post(page, `/api/v1/workspaces/${ws}/tasks`, { title: 'Bölüm 2' });

    await page.goto('/goals');
    await page.getByRole('button', { name: 'Hedef ekle' }).first().click();
    await page.getByRole('dialog').getByLabel('Hedef', { exact: true }).fill('Kitap bitir');
    await page.getByRole('dialog').getByRole('button', { name: 'Hedef ekle' }).click();
    const card = page.locator('[data-goal-card]').filter({ hasText: 'Kitap bitir' });
    await expect(card).toHaveCount(1);

    const goals = (await (await page.request.get(`/api/v1/workspaces/${ws}/goals`)).json())
      .data as { id: string; title: string }[];
    const goal = goals.find((g) => g.title === 'Kitap bitir')!;
    const linked = await page.request.put(`/api/v1/workspaces/${ws}/goals/${goal.id}/links`, {
      data: { taskIds: [a.id, b.id], projectIds: [] },
      headers: origin,
    });
    expect(linked.status(), await linked.text()).toBe(200);
    const done = await page.request.post(`/api/v1/workspaces/${ws}/tasks/${a.id}/complete`, {
      data: { version: a.version },
      headers: origin,
    });
    expect(done.ok()).toBe(true);

    await page.goto('/goals');
    await expect(card).toContainText('1/2 · %50');
    await page.request.post(`/api/v1/workspaces/${ws}/tasks/${b.id}/complete`, {
      data: { version: b.version },
      headers: origin,
    });
    await page.goto('/goals');
    await card.click();
    const detail = page.locator('[data-goal-detail]');
    await expect(detail).toContainText('2/2 · %100');
    // BR-GOAL-003: kendiliğinden "Ulaşıldı" olmaz; kullanıcı onaylar.
    await expect(detail.locator('[data-mark-achieved]')).toBeVisible();
    await page.goto('/goals?status=achieved');
    await expect(page.locator('[data-goal-card]')).toHaveCount(0);
    await page.goBack();
    await detail.locator('[data-mark-achieved]').click();
    await expect(page.locator('[data-mark-achieved]')).toHaveCount(0);
    await page.goto('/goals?status=achieved');
    await expect(page.locator('[data-goal-card]').filter({ hasText: 'Kitap bitir' })).toHaveCount(
      1,
    );
  });

  test('erişilebilirlik: notlar, hedefler ve arama paletinde ciddi ihlal yok', async ({ page }) => {
    test.skip(isMobile(), 'Masaüstü taraması yeterli; mobil düzen kabuk testlerinde taranır.');
    await signUp(page);
    const ws = await workspace(page);
    const note = await post(page, `/api/v1/workspaces/${ws}/notes`, {
      title: 'Erişilebilir not',
      body: '- madde',
    });
    await post(page, `/api/v1/workspaces/${ws}/goals`, { title: 'Erişilebilir hedef' });
    await page.goto(`/notes?note=${note.id}`);
    await expect(page.locator('[data-note-editor]')).toBeVisible();
    await expectNoSeriousA11y(page);
    await page.goto('/goals');
    await expect(page.locator('[data-goal-card]')).toHaveCount(1);
    await expectNoSeriousA11y(page);
    await page.keyboard.press('ControlOrMeta+k');
    await page.locator('[data-search-palette]').getByRole('combobox').fill('erisilebilir');
    await expect(page.getByRole('option').first()).toBeVisible();
    await expectNoSeriousA11y(page);
  });
});
