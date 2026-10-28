import { expect, test } from '@playwright/test';

test.describe('Faz 2 temel', () => {
  test('giriş sayfası Türkçe açılır ve çalışmayan özellik göstermez', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
    // Yalnızca giriş formunun düğmesi vardır (geliştirme modundaki Next.js araç düğmesi hariç).
    await expect(page.getByRole('main').getByRole('button')).toHaveText(['Giriş yap']);
  });

  test('İngilizce tarayıcıda İngilizce açılır (D-038)', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'en-US',
      extraHTTPHeaders: { 'accept-language': 'en-US,en' },
    });
    const page = await context.newPage();
    await page.goto('/sign-in');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await context.close();
  });

  test('geliştirme bileşen sayfası (/dev/ui) üretim derlemesinde kapalıdır', async ({ page }) => {
    // Bileşenlerin erişilebilirliği gerçek sayfalardaki axe taramalarıyla denetlenir (auth, shell, account, onboarding).
    const response = await page.goto('/dev/ui');
    expect(response?.status()).toBe(404);
  });

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
