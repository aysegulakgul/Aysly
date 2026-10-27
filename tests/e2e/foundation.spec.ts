import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Faz 2 temel', () => {
  test('ana sayfa çalışmayan özellik göstermez ve Türkçe açılır', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
    await expect(page.getByText('Aysly geliştiriliyor')).toBeVisible();
    // Yalnızca uygulama içeriği sayılır (geliştirme modundaki Next.js araç düğmesi hariç).
    await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
  });

  test('İngilizce tarayıcıda İngilizce açılır (D-038)', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'en-US',
      extraHTTPHeaders: { 'accept-language': 'en-US,en' },
    });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByText('Aysly is under construction')).toBeVisible();
    await context.close();
  });

  for (const path of ['/', '/dev/ui']) {
    test(`${path} sayfasında kritik/ciddi erişilebilirlik ihlali yok (AC-11)`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }

  test('sağlık uç noktaları ve güvenlik başlıkları', async ({ request }) => {
    const live = await request.get('/api/health');
    expect(live.ok()).toBe(true);
    const ready = await request.get('/api/health/ready');
    expect(ready.status()).toBe(200);
    expect(await ready.json()).toEqual({ status: 'ready', database: true });
    expect(ready.headers()['x-content-type-options']).toBe('nosniff');
    expect(ready.headers()['x-frame-options']).toBe('DENY');
  });
});
