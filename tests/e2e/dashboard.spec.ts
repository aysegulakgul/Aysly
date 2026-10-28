import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { E2E_BASE_URL } from './e2e-env';
import { signUp } from './helpers';

const origin = { origin: E2E_BASE_URL };

/** İstanbul saatine göre bugünden gün kaydırması (testler Europe/Istanbul tercihleriyle çalışır). */
const day = (offset: number) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(
    new Date(),
  );
  return new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);
};

async function setup(page: Page) {
  await signUp(page);
  const ws = (await (await page.request.get('/api/v1/workspaces')).json()).data[0].id as string;
  const create = async (body: Record<string, unknown>) =>
    (
      await (
        await page.request.post(`/api/v1/workspaces/${ws}/tasks`, {
          data: body,
          headers: {
            ...origin,
            'idempotency-key': `db-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          },
        })
      ).json()
    ).data as { id: string };
  return { ws, create };
}

/** Başlığıyla bulunan bölüm paneli (UI/Panel). */
const panel = (page: Page, name: string) =>
  page
    .locator('section')
    .filter({ has: page.getByRole('heading', { level: 2, name, exact: true }) });

test.describe('Bugün ekranı', () => {
  test('FR-DASH-01..04: bölümler doğru görevleri gösterir; geciken görev tek tıkla bugüne taşınır', async ({
    page,
  }) => {
    const { create } = await setup(page);
    await create({ title: 'Elektrik faturasını öde', due: { date: day(-3) }, priority: 3 });
    await create({ title: 'Market alışverişi', due: { date: day(0) } });
    await create({ title: 'İçerik toplama', due: { date: day(2) } });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(panel(page, 'Bugün')).toContainText('Market alışverişi');
    await expect(panel(page, 'Geciken')).toContainText('Elektrik faturasını öde');
    await expect(panel(page, 'Yaklaşan')).toContainText('İçerik toplama');
    await expect(panel(page, 'Öncelikli')).toContainText('Elektrik faturasını öde');

    await panel(page, 'Geciken').getByRole('button', { name: 'Bugüne taşı' }).click();
    await expect(panel(page, 'Geciken')).toContainText('Geciken görev yok.');
    await expect(panel(page, 'Bugün')).toContainText('Elektrik faturasını öde');
  });

  test('BR-DASH-001: "Düzenle" ile gizlenen bölüm kalıcı olarak gizlenir', async ({ page }) => {
    const { create } = await setup(page);
    await create({ title: 'Bir görev', due: { date: day(0) } });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Düzenle' }).click();
    const dialog = page.getByRole('dialog', { name: 'Bölümleri düzenle' });
    await dialog
      .locator('label', { has: page.getByRole('checkbox', { name: 'Öncelikli' }) })
      .click();
    await dialog.getByRole('button', { name: 'Kaydet' }).click();
    const heading = (name: string) => page.getByRole('heading', { level: 2, name, exact: true });
    await expect(heading('Öncelikli')).toHaveCount(0);
    await page.reload();
    await expect(heading('Öncelikli')).toHaveCount(0);
    await expect(heading('Bugün')).toBeVisible();
  });

  test('ONBOARDING §4: İlk adımlar verilerden işaretlenir ve kapatılınca kaybolur', async ({
    page,
  }) => {
    const { create } = await setup(page);
    await page.goto('/');
    const steps = panel(page, 'İlk adımlar');
    await expect(steps).toContainText('0/4');
    await create({ title: 'İlk görev', due: { date: day(1) } });
    await page.reload();
    await expect(steps).toContainText('2/4');
    await page.waitForLoadState('networkidle');
    await steps.getByRole('button', { name: 'İlk adımlar listesini kapat' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'İlk adımlar' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { level: 2, name: 'İlk adımlar' })).toHaveCount(0);
  });

  test('FR-DASH-03: Yaklaşanlar sonraki 7 günü gün gün gösterir', async ({ page }) => {
    const { create } = await setup(page);
    await create({ title: 'Yarın işi', due: { date: day(1) } });
    await create({ title: 'Haftaya işi', due: { date: day(7) } });
    await create({ title: 'Uzak iş', due: { date: day(8) } });
    await page.goto('/upcoming');
    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveCount(2);
    await expect(page.getByText('Yarın işi')).toBeVisible();
    await expect(page.getByText('Haftaya işi')).toBeVisible();
    await expect(page.getByText('Uzak iş')).toHaveCount(0);
  });

  test('klavye kısayolları: ?, G I, J, Ctrl+Enter ve Ctrl+Z', async ({ page }) => {
    const { create } = await setup(page);
    await create({ title: 'Kısayol görevi' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('body').click({ position: { x: 5, y: 5 } });

    await page.keyboard.press('Shift+Slash');
    await expect(page.getByRole('dialog', { name: 'Klavye kısayolları' })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.keyboard.press('g');
    await page.keyboard.press('i');
    await expect(page).toHaveURL('/inbox');
    await page.waitForLoadState('networkidle');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('j');
    await expect(page.getByRole('link', { name: 'Kısayol görevi' })).toBeFocused();
    await page.keyboard.press('Control+Enter');
    await expect(page.getByText('Görev tamamlandı.')).toBeVisible();
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('link', { name: 'Kısayol görevi' })).toBeVisible();

    // "?" açıldığı için İlk adımlar'daki kısayol maddesi de işaretlendi.
    await page.goto('/');
    await expect(panel(page, 'İlk adımlar')).toContainText('2/4');
  });

  test('/ ve /upcoming erişilebilirlik taraması (AC-11)', async ({ page }) => {
    const { create } = await setup(page);
    await create({ title: 'Geciken', due: { date: day(-1) } });
    await create({ title: 'Yaklaşan', due: { date: day(1) } });
    for (const path of ['/', '/upcoming']) {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(serious.map((v) => `${path} ${v.id}: ${v.nodes.length}`)).toEqual([]);
    }
  });
});
