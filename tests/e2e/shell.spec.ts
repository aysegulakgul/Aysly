import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { E2E_BASE_URL } from './e2e-env';
import { PASSWORD, signUp } from './helpers';

const isMobile = () => test.info().project.name === 'mobile';

/** Ayarlara masaüstünde kenar çubuğundan, mobilde Menü ekranından gidilir. */
async function openSettings(page: Page) {
  if (isMobile()) {
    await page
      .getByRole('navigation', { name: 'Alt menü' })
      .getByRole('link', { name: 'Menü' })
      .click();
    await expect(page).toHaveURL('/menu');
    await page.getByRole('main').getByRole('link', { name: 'Ayarlar' }).click();
  } else {
    await page
      .getByRole('navigation', { name: 'Ana menü' })
      .getByRole('link', { name: 'Ayarlar' })
      .click();
  }
  await expect(page).toHaveURL('/settings/appearance');
}

/** Görsel seçenek kartına/sekmesine tıklar (radyo düğmesi görsel olarak gizlidir). */
async function choose(page: Page, name: string) {
  await page.locator('label', { has: page.getByRole('radio', { name }) }).click();
}

/** Kayıt otomatik kaydedilir; başarı metni ve sunucudaki değer birlikte beklenir. */
async function expectSaved(page: Page) {
  await expect(page.getByRole('status').filter({ hasText: /kaydedildi|were saved/ })).toBeVisible();
}

test.describe('Uygulama kabuğu ve ayarlar', () => {
  test('kabuk yalnızca çalışan bölümleri gösterir; selamlama kullanıcının adıyla', async ({
    page,
  }) => {
    await signUp(page, undefined, 'Elif Yılmaz');
    await expect(page.getByRole('heading', { level: 1, name: /, Elif$/ })).toBeVisible();
    const nav = isMobile()
      ? page.getByRole('navigation', { name: 'Alt menü' })
      : page.getByRole('navigation', { name: 'Ana menü' });
    await expect(nav.getByRole('link', { name: 'Bugün' })).toHaveAttribute('aria-current', 'page');
    // Henüz yapılmamış bölümler menüde yer almaz.
    for (const missing of ['Görevlerim', 'Takvim', 'Projeler', 'Hedefler', 'Notlar']) {
      await expect(page.getByRole('link', { name: missing })).toHaveCount(0);
    }
  });

  test('BR-PREF-003: tema ve yoğunluk değişir, yeniden yüklemede korunur', async ({ page }) => {
    await signUp(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'system'); // BR-PREF-001
    await openSettings(page);

    await choose(page, 'Açık');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expectSaved(page);
    await choose(page, 'Sıkı');
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
    await expectSaved(page);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
    await expect(page.getByRole('radio', { name: 'Açık' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Sıkı' })).toBeChecked();
  });

  test('dil İngilizceye geçer; tercih kalıcıdır ve çıkıştan sonra giriş ekranı da İngilizcedir', async ({
    page,
  }) => {
    await signUp(page);
    await openSettings(page);
    await page.getByLabel('Uygulama dili').selectOption('en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('App language')).toHaveValue('en');

    if (isMobile()) {
      await page.goto('/menu');
      await page.getByRole('main').getByRole('button', { name: 'Sign out' }).click();
    } else {
      await page.getByRole('complementary').getByRole('button', { name: 'Sign out' }).click();
    }
    await expect(page).toHaveURL('/sign-in');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('BR-PREF-001: saat dilimi değişir ve kalıcıdır', async ({ page }) => {
    await signUp(page);
    await page.goto('/settings/date-time');
    await page.getByLabel('Saat dilimi').selectOption('America/New_York');
    await expectSaved(page);
    await page.getByLabel('Hafta başlangıcı').selectOption('0');
    await expectSaved(page);
    await page.reload();
    await expect(page.getByLabel('Saat dilimi')).toHaveValue('America/New_York');
    await expect(page.getByLabel('Hafta başlangıcı')).toHaveValue('0');
    if (!isMobile()) await expect(page.getByText(/· New York$/)).toBeVisible();
  });

  test('BR-ACC-006: çıkış düğmesi oturumu kapatır; korumalı sayfa girişe yönlendirir', async ({
    page,
  }) => {
    const email = await signUp(page);
    if (isMobile()) {
      await page.goto('/menu');
      await page.getByRole('main').getByRole('button', { name: 'Çıkış yap' }).click();
    } else {
      await page.getByRole('complementary').getByRole('button', { name: 'Çıkış yap' }).click();
    }
    await expect(page).toHaveURL('/sign-in');
    await page.goto('/settings/appearance');
    await expect(page).toHaveURL(/\/sign-in$/);

    // Aynı hesapla yeniden giriş: tercihler korunur.
    await page.getByLabel('E-posta').fill(email);
    await page.getByLabel('Şifre').fill(PASSWORD);
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(page).toHaveURL('/');
  });

  for (const path of ['/', '/menu', '/settings/appearance', '/settings/date-time']) {
    test(`${path} erişilebilirlik taraması (AC-11)`, async ({ page }) => {
      await signUp(page);
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

test.describe('PATCH /api/v1/me/preferences (oturumsuz 401: authorization.spec.ts)', () => {
  const url = '/api/v1/me/preferences';
  const origin = { origin: E2E_BASE_URL };

  test('doğrulama, sürüm çakışması ve Origin kontrolü', async ({ page }) => {
    await signUp(page);
    const api = page.request;

    const current = await (await api.get(url)).json();
    // Onboarding tamamlandığında da sürüm artar; testler güncel sürümden ilerler.
    expect(current.data).toMatchObject({ theme: 'system' });
    const v: number = current.data.version;

    // BR-PREF-001: geçersiz saat dilimi → 400
    const badTz = await api.patch(url, {
      data: { version: v, timezone: 'Mars/Olympus' },
      headers: origin,
    });
    expect(badTz.status()).toBe(400);
    expect((await badTz.json()).error.details).toEqual([{ field: 'timezone', reason: 'invalid' }]);

    // Bilinmeyen alan ve izinli olmayan değer → 400
    expect(
      (await api.patch(url, { data: { version: v, userId: 'x' }, headers: origin })).status(),
    ).toBe(400);
    expect(
      (await api.patch(url, { data: { version: v, theme: 'neon' }, headers: origin })).status(),
    ).toBe(400);

    // Başka kökenden yazma isteği → 403
    const csrf = await api.patch(url, {
      data: { version: v, theme: 'dark' },
      headers: { origin: 'https://evil.example' },
    });
    expect(csrf.status()).toBe(403);

    const ok = await api.patch(url, { data: { version: v, theme: 'dark' }, headers: origin });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).data).toMatchObject({ theme: 'dark', version: v + 1 });

    // Eski sürüm → 409 ve güncel kayıt
    const stale = await api.patch(url, { data: { version: v, theme: 'light' }, headers: origin });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error).toMatchObject({
      code: 'VERSION_CONFLICT',
      current: { theme: 'dark', version: v + 1 },
    });
  });
});
