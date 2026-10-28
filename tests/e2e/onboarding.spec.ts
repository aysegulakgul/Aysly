import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { E2E_BASE_URL } from './e2e-env';
import { signIn, signUp } from './helpers';

const origin = { origin: E2E_BASE_URL };

test.describe('Onboarding (ONBOARDING §2–3)', () => {
  test('kayıttan sonra açılır; amaç, örnek projeler ve tercihlerle tamamlanır', async ({
    page,
  }) => {
    await signUp(page, undefined, 'Elif Yılmaz', { keepOnboarding: true });
    await expect(page.getByText('Adım 1/3')).toBeVisible();
    await page
      .locator('label', { has: page.getByRole('checkbox', { name: 'Kişisel hayatım' }) })
      .click();
    await page
      .locator('label', { has: page.getByRole('checkbox', { name: 'İşim ve projelerim' }) })
      .click();
    await page.getByRole('button', { name: 'Devam' }).click();

    await expect(page.getByText('Adım 2/3')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Evet, oluştur' })).toBeChecked();
    await expect(page.getByText('Oluşturulacak projeler: Ev, İş')).toBeVisible();
    await page.getByRole('button', { name: 'Devam' }).click();

    await expect(page.getByText('Adım 3/3')).toBeVisible();
    await expect(page.getByLabel('Saat dilimi')).toHaveValue('Europe/Istanbul');
    await page.getByLabel('Hafta başlangıcı').selectOption('0');
    await page.getByRole('button', { name: 'Bitir' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1, name: /, Elif$/ })).toBeVisible();
    const prefs = (await (await page.request.get('/api/v1/me/preferences')).json()).data;
    expect(prefs.weekStart).toBe(0);
    // Tamamlanınca bir daha önerilmez
    await page.goto('/onboarding');
    await expect(page).toHaveURL('/');
  });

  test('bir kez atlanınca sonraki girişte bir kez daha önerilir; ikinci atlamadan sonra önerilmez', async ({
    page,
    browser,
  }) => {
    const email = await signUp(page, undefined, undefined, { keepOnboarding: true });
    await page.getByRole('button', { name: 'Atla' }).click();
    await expect(page).toHaveURL('/');
    await page.reload();
    await expect(page).toHaveURL('/'); // aynı oturumda tekrar sorulmaz

    const second = await browser.newContext({ locale: 'tr-TR' });
    const p2 = await second.newPage();
    await p2.goto('/sign-in');
    await p2.getByLabel('E-posta').fill(email);
    await p2.getByLabel('Şifre').fill('ayisigi gece 2026');
    await p2.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(p2).toHaveURL('/onboarding'); // sonraki giriş
    await p2.waitForLoadState('networkidle'); // yönlendirme sonrası sayfa etkileşime hazır olsun
    await p2.getByRole('button', { name: 'Atla' }).click();
    await expect(p2).toHaveURL('/');
    await second.close();

    const third = await browser.newContext({ locale: 'tr-TR' });
    await signIn(await third.newPage(), email); // artık doğrudan ana sayfa
    await third.close();
  });

  test('Ayarlar’dan yeniden başlatılır; örnek projeler daha önce oluşturulduysa o adım atlanır', async ({
    page,
  }) => {
    await signUp(page);
    const done = await page.request.post('/api/v1/me/onboarding/restart', { headers: origin });
    expect(done.ok()).toBe(true);
    await page.request.post('/api/v1/me/onboarding', {
      data: { intents: ['work'], createSamples: true },
      headers: origin,
    });
    await page.goto('/settings/profile');
    await page.getByRole('button', { name: 'Rehberi yeniden başlat' }).click();
    await expect(page).toHaveURL('/onboarding');
    await expect(page.getByText('Adım 1/2')).toBeVisible();
  });

  test('geçersiz gövde reddedilir', async ({ page }) => {
    await signUp(page);
    const bad = await page.request.post('/api/v1/me/onboarding', {
      data: { intents: ['hobi'], createSamples: true },
      headers: origin,
    });
    expect(bad.status()).toBe(400);
  });

  test('/onboarding erişilebilirlik taraması (AC-11)', async ({ page }) => {
    await signUp(page, undefined, undefined, { keepOnboarding: true });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
